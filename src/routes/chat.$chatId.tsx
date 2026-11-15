import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImageIcon, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";
import { ProfileDialog } from "@/components/ProfileDialog";

export const Route = createFileRoute("/chat/$chatId")({
  head: () => ({
    meta: [
      { title: "チャット欄" },
      { name: "description", content: "文字と画像で会話できるチャット欄。" },
      { property: "og:title", content: "チャット欄" },
      { property: "og:description", content: "文字と画像で会話できるチャット欄。" },
    ],
  }),
  component: ChatPage,
});

const MAX = 200000;
type Msg = { id: string; sender_id: string; sender_name: string; content: string; image_url: string | null; created_at: string };

function ChatPage() {
  const { chatId } = Route.useParams();
  const [title, setTitle] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [me, setMe] = useState("");
  const [viewImg, setViewImg] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase.from("messages").select("*").eq("chat_id", chatId).order("created_at");
    const list = (data ?? []) as Msg[];
    setMsgs(list);
    const paths = list.map((m) => m.image_url).filter((p): p is string => !!p);
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("chat-images").createSignedUrls(paths, 60 * 60 * 24 * 7);
      const map: Record<string, string> = {};
      signed?.forEach((s) => { if (s.path && s.signedUrl) map[s.path] = s.signedUrl; });
      setUrls(map);
    }
  };

  useEffect(() => {
    setMe(getDeviceId());
    supabase.from("chats").select("name").eq("id", chatId).maybeSingle().then(({ data }) => setTitle(data?.name ?? ""));
    load();
    const ch = supabase.channel(`msgs-${chatId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [chatId]);

  useEffect(() => { endRef.current?.scrollIntoView(); }, [msgs.length]);

  const myName = async () => {
    const { data } = await supabase.from("profiles").select("name").eq("id", me).maybeSingle();
    return data?.name || "名無し";
  };

  const send = async (image?: string) => {
    const body = image ? "" : text.trim();
    if (!body && !image) return;
    setSending(true);
    await supabase.from("messages").insert({ chat_id: chatId, sender_id: me, sender_name: await myName(), content: body, image_url: image ?? null });
    if (!image) setText("");
    setSending(false);
    load();
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setSending(true);
    const path = `${chatId}/${crypto.randomUUID()}-${f.name.replace(/[^\w.]/g, "_")}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, f, { contentType: f.type });
    setSending(false);
    if (error) { alert("画像の送信に失敗しました"); return; }
    await send(path);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center gap-4 border-b border-border bg-surface px-5 py-4">
        <Link to="/" aria-label="戻る"><ArrowLeft className="h-6 w-6" /></Link>
        <div className="min-w-0"><div className="truncate text-xl font-bold">{title}</div><div className="truncate text-sm text-muted-foreground">{title}</div></div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && <p className="pt-24 text-center text-muted-foreground">まだメッセージがありません</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <button onClick={() => setProfileId(m.sender_id)} className="mb-1 text-xs font-semibold text-primary underline-offset-2 hover:underline">
                {m.sender_name || "名無し"}
              </button>
              {m.image_url ? (
                urls[m.image_url] ? (
                  <img src={urls[m.image_url]} alt="送信画像" onClick={() => setViewImg(urls[m.image_url!] ?? null)} className="h-28 w-28 cursor-pointer rounded-xl object-cover" />
                ) : <div className="h-28 w-28 rounded-xl bg-muted" />
              ) : (
                <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 ${mine ? "bg-bubble-me text-bubble-me-foreground" : "bg-surface"}`}>{m.content}</div>
              )}
              <span className="mt-1 text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <footer className="border-t border-border bg-surface px-4 pb-4 pt-3">
        <div className="flex items-end gap-3">
          <button onClick={() => fileRef.current?.click()} disabled={sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted" aria-label="画像を送る">
            <ImageIcon className="h-5 w-5" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <textarea value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} placeholder="メッセージを入力" rows={1} className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2 outline-none" />
          <button onClick={() => send()} disabled={sending || !text.trim()} className="bg-send flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary-foreground shadow disabled:opacity-60" aria-label="送信">
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
