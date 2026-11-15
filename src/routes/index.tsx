import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, MessageSquare, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createDeviceProfile,
  getDeviceId,
  getSavedProfileIds,
  rememberProfile,
  switchDeviceProfile,
} from "@/lib/device";
import { ProfileSwitcher, type SavedProfile } from "@/components/ProfileSwitcher";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "チャット｜プロフィールとチャット欄" },
      { name: "description", content: "プロフィールを設定して、画像も送れるチャット欄で会話しよう。" },
      { property: "og:title", content: "チャット｜プロフィールとチャット欄" },
      { property: "og:description", content: "プロフィールを設定して、画像も送れるチャット欄で会話しよう。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Chat = { id: string; name: string };

function Index() {
  const [me, setMe] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [switching, setSwitching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [newChat, setNewChat] = useState("");

  const loadChats = useCallback(async () => {
    const { data } = await supabase.from("chats").select("id,name").order("created_at");
    setChats(data ?? []);
  }, []);

  useEffect(() => {
    const id = getDeviceId();
    setMe(id);
    const ids = [...new Set([id, ...getSavedProfileIds()])];

    void supabase.from("profiles").select("id,name,age,bio").in("id", ids).then(({ data }) => {
      const list = (data ?? []) as SavedProfile[];
      if (list.some((profile) => profile.id === id)) rememberProfile(id);
      setProfiles(list);
      const current = list.find((profile) => profile.id === id);
      if (current) {
        setName(current.name);
        setAge(current.age?.toString() ?? "");
        setBio(current.bio);
      }
    });
    void loadChats();

    const channel = supabase.channel(`chats-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldChat = payload.old as Partial<Chat>;
          setChats((current) => current.filter((chat) => chat.id !== oldChat.id));
          return;
        }
        const changed = payload.new as Chat;
        setChats((current) => {
          const exists = current.some((chat) => chat.id === changed.id);
          return exists
            ? current.map((chat) => chat.id === changed.id ? changed : chat)
            : [...current, changed];
        });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadChats]);

  const saveProfile = async () => {
    if (saving || !me) return;
    setSaving(true);
    const parsedAge = parseInt(age, 10);
    const profile: SavedProfile = {
      id: me,
      name: name.trim(),
      age: Number.isNaN(parsedAge) ? null : parsedAge,
      bio,
    };
    const { error } = await supabase.from("profiles").upsert({
      ...profile,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      alert("プロフィールを保存できませんでした。もう一度お試しください。");
      return;
    }
    rememberProfile(me);
    setProfiles((current) => [...current.filter((item) => item.id !== me), profile]);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const selectProfile = (profile: SavedProfile) => {
    switchDeviceProfile(profile.id);
    setMe(profile.id);
    setName(profile.name);
    setAge(profile.age?.toString() ?? "");
    setBio(profile.bio);
    setSaved(false);
    setSwitching(false);
  };

  const createProfile = () => {
    const id = createDeviceProfile();
    setMe(id);
    setName("");
    setAge("");
    setBio("");
    setSaved(false);
    setSwitching(false);
  };

  const addChat = async () => {
    const trimmedName = newChat.trim();
    if (!trimmedName) return;
    const chat: Chat = { id: crypto.randomUUID(), name: trimmedName };
    setNewChat("");
    setChats((current) => [...current, chat]);
    const { error } = await supabase.from("chats").insert(chat);
    if (error) {
      setChats((current) => current.filter((item) => item.id !== chat.id));
      setNewChat((current) => current || trimmedName);
      alert("チャット欄を追加できませんでした。もう一度お試しください。");
    }
  };

  const delChat = async (id: string) => {
    if (!confirm("このチャット欄を削除しますか？")) return;
    const previous = chats;
    setChats((current) => current.filter((chat) => chat.id !== id));
    const { error } = await supabase.from("chats").delete().eq("id", id);
    if (error) {
      setChats(previous);
      alert("チャット欄を削除できませんでした。もう一度お試しください。");
    }
  };

  const input = "w-full rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-6 px-5 py-8">
      <section className="space-y-3 rounded-3xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold">プロフィール</h1>
          {profiles.length > 0 && (
            <button
              onClick={() => setSwitching(true)}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm font-bold text-primary"
            >
              <ArrowLeftRight className="h-4 w-4" />
              切替
            </button>
          )}
        </div>
        <input aria-label="名前" className={input} placeholder="名前" maxLength={50} value={name} onChange={(event) => setName(event.target.value)} />
        <input aria-label="年齢" className={input} placeholder="年齢" inputMode="numeric" value={age} onChange={(event) => setAge(event.target.value.replace(/\D/g, "").slice(0, 3))} />
        <textarea aria-label="プロフィール" className={`${input} min-h-24`} placeholder="プロフィール" maxLength={1000} value={bio} onChange={(event) => setBio(event.target.value)} />
        <button onClick={saveProfile} disabled={saving || !me} className="w-full rounded-2xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-60">
          {saving ? "保存中…" : saved ? "保存しました" : "保存"}
        </button>
      </section>

      <div className="flex gap-3">
        <input aria-label="新しいチャット欄" className={input} placeholder="新しいチャット欄" maxLength={50} value={newChat} onChange={(event) => setNewChat(event.target.value)} onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && addChat()} />
        <button onClick={addChat} className="flex shrink-0 items-center gap-1 rounded-2xl bg-primary px-5 font-bold text-primary-foreground">
          <Plus className="h-5 w-5" />追加
        </button>
      </div>

      <div className="space-y-3">
        {chats.map((chat) => (
          <div key={chat.id} className="flex items-center gap-4 rounded-3xl border border-border bg-surface p-5">
            <Link to="/chat/$chatId" params={{ chatId: chat.id }} className="flex min-w-0 flex-1 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-chip"><MessageSquare className="h-5 w-5 text-primary" /></span>
              <span className="truncate text-lg font-bold">{chat.name}</span>
            </Link>
            <button onClick={() => delChat(chat.id)} aria-label={`チャット欄 ${chat.name} を削除`}><Trash2 className="h-5 w-5 text-destructive" /></button>
          </div>
        ))}
      </div>

      {switching && (
        <ProfileSwitcher
          profiles={profiles}
          activeId={me}
          onSelect={selectProfile}
          onCreate={createProfile}
          onClose={() => setSwitching(false)}
        />
      )}
    </main>
  );
}
