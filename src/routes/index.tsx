import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "チャット｜プロフィールとチャット欄" },
      { name: "description", content: "プロフィールを設定して、画像も送れるチャット欄で会話しよう。" },
      { property: "og:title", content: "チャット｜プロフィールとチャット欄" },
      { property: "og:description", content: "プロフィールを設定して、画像も送れるチャット欄で会話しよう。" },
    ],
  }),
  component: Index,
});

type Chat = { id: string; name: string };

function Index() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [newChat, setNewChat] = useState("");

  const loadChats = () =>
    supabase.from("chats").select("id,name").order("created_at").then(({ data }) => setChats(data ?? []));

  useEffect(() => {
    const id = getDeviceId();
    supabase.from("profiles").select("name,age,bio").eq("id", id).maybeSingle().then(({ data }) => {
      if (data) { setName(data.name); setAge(data.age?.toString() ?? ""); setBio(data.bio); }
    });
    loadChats();
    const ch = supabase.channel(`chats-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => loadChats())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const saveProfile = async () => {
    const a = parseInt(age, 10);
    await supabase.from("profiles").upsert({ id: getDeviceId(), name: name.trim(), age: isNaN(a) ? null : a, bio, updated_at: new Date().toISOString() });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const addChat = async () => {
    const n = newChat.trim();
    if (!n) return;
    setNewChat("");
    await supabase.from("chats").insert({ name: n });
    loadChats();
  };

  const delChat = async (id: string) => {
    if (!confirm("このチャット欄を削除しますか？")) return;
    await supabase.from("chats").delete().eq("id", id);
    loadChats();
  };

  const input = "w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-6 px-5 py-8">
      <section className="space-y-3 rounded-3xl border border-border bg-surface p-5">
        <h1 className="text-lg font-bold">プロフィール</h1>
        <input className={input} placeholder="名前" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} placeholder="年齢" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} />
        <textarea className={`${input} min-h-24`} placeholder="プロフィール" maxLength={1000} value={bio} onChange={(e) => setBio(e.target.value)} />
        <button onClick={saveProfile} className="w-full rounded-2xl bg-primary py-3 font-bold text-primary-foreground">
          {saved ? "保存しました" : "保存"}
        </button>
      </section>

      <div className="flex gap-3">
        <input className={input} placeholder="新しいチャット欄" maxLength={50} value={newChat} onChange={(e) => setNewChat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addChat()} />
        <button onClick={addChat} className="flex shrink-0 items-center gap-1 rounded-2xl bg-primary px-5 font-bold text-primary-foreground">
          <Plus className="h-5 w-5" />追加
        </button>
      </div>

      <div className="space-y-3">
        {chats.map((c) => (
          <div key={c.id} className="flex items-center gap-4 rounded-3xl border border-border bg-surface p-5">
            <Link to="/chat/$chatId" params={{ chatId: c.id }} className="flex flex-1 items-center gap-4 min-w-0">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-chip"><MessageSquare className="h-5 w-5 text-primary" /></span>
              <span className="truncate text-lg font-bold">{c.name}</span>
            </Link>
            <button onClick={() => delChat(c.id)} aria-label="削除"><Trash2 className="h-5 w-5 text-destructive" /></button>
          </div>
        ))}
      </div>
    </main>
  );
}
