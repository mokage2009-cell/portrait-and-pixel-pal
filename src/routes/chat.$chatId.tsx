import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ImageIcon, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";
import { canDeleteMessage } from "@/lib/chat";
import { ProfileDialog } from "@/components/ProfileDialog";

export const Route = createFileRoute("/chat/$chatId")({
  head: () => ({
    meta: [
      { title: "チャット欄" },
      { name: "description", content: "文字と画像で会話できるチャット欄。" },
      { property: "og:title", content: "チャット欄" },
      { property: "og:description", content: "文字と画像で会話できるチャット欄。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

const MAX = 200000;
const MESSAGE_COLUMNS = "id,sender_id,sender_name,content,image_url,created_at";
type Msg = { id: string; sender_id: string; sender_name: string; content: string; image_url: string | null; created_at: string };

function ChatPage() {
  const { chatId } = Route.useParams();
  const [title, setTitle] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [me, setMe] = useState("");
  const [myName, setMyName] = useState("名無し");
  const [viewImg, setViewImg] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const urlsRef = useRef<Record<string, string>>({});

  const loadSignedUrls = useCallback(async (paths: string[]) => {
    const missing = [...new Set(paths)].filter((path) => !urlsRef.current[path]);
    if (missing.length === 0) return;
    const { data: signed } = await supabase.storage.from("chat-images").createSignedUrls(missing, 60 * 60 * 24 * 7);
    if (!signed) return;
    const map: Record<string, string> = {};
    signed.forEach((item) => {
      if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
    });
    urlsRef.current = { ...urlsRef.current, ...map };
    setUrls(urlsRef.current);
  }, []);

  const upsertMessage = useCallback((message: Msg) => {
    setMsgs((current) => {
      const exists = current.some((item) => item.id === message.id);
      const next = exists
        ? current.map((item) => item.id === message.id ? message : item)
        : [...current, message];
      return next.sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
    if (message.image_url) void loadSignedUrls([message.image_url]);
  }, [loadSignedUrls]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("messages").select(MESSAGE_COLUMNS).eq("chat_id", chatId).order("created_at");
    const list = (data ?? []) as Msg[];
    setMsgs(list);
    const paths = list.map((message) => message.image_url).filter((path): path is string => !!path);
    void loadSignedUrls(paths);
  }, [chatId, loadSignedUrls]);

  useEffect(() => {
    const id = getDeviceId();
    setMe(id);
    setMsgs([]);
    setUrls({});
    urlsRef.current = {};

    void Promise.all([
      supabase.from("chats").select("name").eq("id", chatId).maybeSingle(),
      supabase.from("profiles").select("name").eq("id", id).maybeSingle(),
    ]).then(([chat, profile]) => {
      setTitle(chat.data?.name ?? "");
      setMyName(profile.data?.name || "名無し");
    });
    void load();

    const channel = supabase.channel(`msgs-${chatId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldMessage = payload.old as Partial<Msg>;
          setMsgs((current) => current.filter((message) => message.id !== oldMessage.id));
          return;
        }
        upsertMessage(payload.new as Msg);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [chatId, load, upsertMessage]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async (image?: string): Promise<boolean> => {
    const body = image ? "" : text.trim();
    if ((!body && !image) || !me) return false;
    const message: Msg = {
      id: crypto.randomUUID(),
      sender_id: me,
      sender_name: myName,
      content: body,
      image_url: image ?? null,
      created_at: new Date().toISOString(),
    };
    if (!image) setText("");
    setSending(true);
    upsertMessage(message);
    const { data, error } = await supabase.from("messages").insert({
      ...message,
      chat_id: chatId,
    }).select(MESSAGE_COLUMNS).single();
    setSending(false);
    if (error) {
      setMsgs((current) => current.filter((item) => item.id !== message.id));
      if (!image) setText((current) => current || body);
      alert("送信できませんでした。もう一度お試しください。");
      return false;
    }
    upsertMessage(data as Msg);
    return true;
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !me) return;
    setSending(true);
    const path = `${chatId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.]/g, "_")}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file, { contentType: file.type });
    if (error) {
      setSending(false);
      alert("画像の送信に失敗しました");
      return;
    }
    const sent = await send(path);
    if (!sent) await supabase.storage.from("chat-images").remove([path]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const deleteMessage = async (message: Msg) => {
    if (!canDeleteMessage(message.sender_id, me) || deletingIds.includes(message.id)) return;
    if (!confirm(message.image_url ? "この画像メッセージを削除しますか？" : "このメッセージを削除しますか？")) return;
    setDeletingIds((current) => [...current, message.id]);
    setMsgs((current) => current.filter((item) => item.id !== message.id));
    const { error } = await supabase.from("messages").delete().eq("id", message.id).eq("sender_id", me);
    if (error) {
      upsertMessage(message);
      alert("削除できませんでした。もう一度お試しください。");
    } else if (message.image_url) {
      const { error: imageError } = await supabase.storage.from("chat-images").remove([message.image_url]);
      if (imageError) alert("メッセージは削除しましたが、画像ファイルを削除できませんでした。");
    }
    setDeletingIds((current) => current.filter((id) => id !== message.id));
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center gap-4 border-b border-border bg-surface px-5 py-4">
        <Link to="/" aria-label="戻る"><ArrowLeft className="h-6 w-6" /></Link>
        <div className="min-w-0"><div className="truncate text-xl font-bold">{title}</div><div className="truncate text-sm text-muted-foreground">{title}</div></div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && <p className="pt-24 text-center text-muted-foreground">まだメッセージがありません</p>}
        {msgs.map((message) => {
          const mine = message.sender_id === me;
          return (
            <div key={message.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <button onClick={() => setProfileId(message.sender_id)} className="mb-1 text-xs font-semibold text-primary underline-offset-2 hover:underline">
                {message.sender_name || "名無し"}
              </button>
              {message.image_url ? (
                urls[message.image_url] ? (
                  <img src={urls[message.image_url]} alt="送信画像" onClick={() => setViewImg(urls[message.image_url!] ?? null)} className="h-28 w-28 cursor-pointer rounded-xl object-cover" />
                ) : <div className="h-28 w-28 rounded-xl bg-muted" aria-label="画像を読み込み中" />
              ) : (
                <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 ${mine ? "bg-bubble-me text-bubble-me-foreground" : "bg-surface"}`}>{message.content}</div>
              )}
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{new Date(message.created_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                {canDeleteMessage(message.sender_id, me) && (
                  <button
                    onClick={() => deleteMessage(message)}
                    disabled={deletingIds.includes(message.id)}
                    aria-label={message.image_url ? "この画像メッセージを削除" : "このメッセージを削除"}
                    className="p-1 text-muted-foreground disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <footer className="border-t border-border bg-surface px-4 pb-4 pt-3">
        <div className="flex items-end gap-3">
          <button onClick={() => fileRef.current?.click()} disabled={sending || !me} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted" aria-label="画像を送る">
            <ImageIcon className="h-5 w-5" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => onFile(event.target.files?.[0])} />
          <textarea aria-label="メッセージ" value={text} maxLength={MAX} onChange={(event) => setText(event.target.value)} placeholder="メッセージを入力" rows={1} className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2 outline-none" />
          <button onClick={() => send()} disabled={sending || !me || !text.trim()} className="bg-send flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary-foreground shadow disabled:opacity-60" aria-label="送信">
            <Send className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-1 text-right text-sm text-muted-foreground">{text.length.toLocaleString()}/{MAX.toLocaleString()}文字</div>
      </footer>

      {viewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-4" onClick={() => setViewImg(null)}>
          <img src={viewImg} alt="拡大画像" className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain" />
        </div>
      )}
      {profileId && <ProfileDialog userId={profileId} onClose={() => setProfileId(null)} />}
    </div>
  );
}
