"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import AnimatedStream from "@/components/AnimatedStream";

interface Message {
  role: "user" | "model";
  content: string;
}

interface Conversation {
  id: string;
  created_at: string;
  title: string | null;
  pinned: boolean;
  pinned_at: string | null;
}

const SidebarToggleIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    className="transition-transform duration-200"
    style={{ transform: isOpen ? "rotate(0deg)" : "rotate(180deg)" }}
  >
    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DotsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);

const PinIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M14 3l7 7-3 1-3 8-2-2-8 3 3-8-2-2 8-3 1-4Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const SettingsIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19.4 15a7.96 7.96 0 0 0 .1-1 7.96 7.96 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8.2 8.2 0 0 0-1.7-1l-.4-2.6H10.1l-.4 2.6a8.2 8.2 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.96 7.96 0 0 0-.1 1c0 .34.03.67.1 1l-2 1.5 2 3.5 2.4-1c.52.4 1.1.73 1.7 1l.4 2.6h3.8l.4-2.6c.6-.27 1.18-.6 1.7-1l2.4 1 2-3.5-2-1.5Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LogoutIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M10 17l-1 0a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h1"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M16 12H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 12l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 12l-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M18 4h1a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-1"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function ChatPage() {
  const router = useRouter();

  // Auth + data
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Chat UI
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // 3-dot menu & modals
  const [openMenuForId, setOpenMenuForId] = useState<string | null>(null);

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete confirm modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);

  // Undo delete
  const [undoBannerOpen, setUndoBannerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    conv: Conversation;
    index: number;
    timeoutId: number;
    startedAt: number;
  } | null>(null);

  // Profile dropdown
  const [profileOpen, setProfileOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Outside click refs
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const profileContainerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const sidebarWidthClass = "w-72"; // 18rem
  const sidebarPaddingLeftDesktop = "lg:pl-72";

  const displayName = useMemo(() => user?.user_metadata?.full_name ?? user?.email ?? "User", [user]);
  const displayEmail = useMemo(() => user?.email ?? "", [user]);
  const avatarLetter = useMemo(() => (user?.email?.charAt(0) ?? "U").toUpperCase(), [user]);

  const fetchConversations = useCallback(async (u: User | null) => {
    if (!u) return;

    const { data, error } = await supabase
      .from("conversations")
      .select("id, created_at, title, pinned, pinned_at")
      .eq("user_id", u.id)
      .order("created_at", { ascending: false }); // DB'den temel sırayı alıyoruz, UI'da pinned'e göre tekrar sıralayacağız

    if (error) {
      console.error("Sohbetler çekilemedi:", error);
      return;
    }

    setConversations((data ?? []) as Conversation[]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Outside click handler
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;

      if (openMenuForId && menuContainerRef.current && target && !menuContainerRef.current.contains(target)) {
        setOpenMenuForId(null);
      }

      if (profileOpen && profileContainerRef.current && target && !profileContainerRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [openMenuForId, profileOpen]);

  // Auth bootstrap
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) {
        router.push("/");
        return;
      }
      setUser(session.user);
      fetchConversations(session.user);
    });

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      setUser(session.user);
      fetchConversations(session.user);
    })();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, fetchConversations]);

  const closeSidebarOnMobile = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/");
  }, [router]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setCurrentConversationId(null);
    setInput("");
    closeSidebarOnMobile();
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [closeSidebarOnMobile]);

  const handleConversationSelect = useCallback(
    async (convId: string) => {
      setCurrentConversationId(convId);
      setMessages([]);
      closeSidebarOnMobile();

      const { data, error } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Mesajlar çekilemedi:", error);
        return;
      }

      setMessages(((data ?? []) as Message[]) || []);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [closeSidebarOnMobile]
  );

  const canSend = useMemo(() => !!user && !!input.trim() && !isGenerating, [user, input, isGenerating]);

  const openRename = useCallback((conv: Conversation) => {
    setOpenMenuForId(null);
    setRenameId(conv.id);
    setRenameValue(conv.title ?? "");
    setRenameModalOpen(true);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  }, []);

  const closeRename = useCallback(() => {
    setRenameModalOpen(false);
    setRenameId(null);
  }, []);

  const submitRename = useCallback(async () => {
    if (!user || !renameId) return;

    const nextTitle = renameValue.trim();
    if (!nextTitle) return;

    setIsRenaming(true);
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ title: nextTitle })
        .eq("id", renameId)
        .eq("user_id", user.id);

      if (error) throw error;

      setConversations((prev) => prev.map((c) => (c.id === renameId ? { ...c, title: nextTitle } : c)));
      closeRename();
    } catch (e) {
      console.error("Rename failed:", e);
    } finally {
      setIsRenaming(false);
    }
  }, [user, renameId, renameValue, closeRename]);

  // ✅ Pin toggle -> DB
  const togglePin = useCallback(
    async (convId: string) => {
      if (!user) return;

      const conv = conversations.find((c) => c.id === convId);
      if (!conv) return;

      const nextPinned = !conv.pinned;

      // Optimistic UI
      const optimisticPinnedAt = nextPinned ? new Date().toISOString() : null;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, pinned: nextPinned, pinned_at: optimisticPinnedAt } : c
        )
      );

      try {
        const patch: Pick<Conversation, "pinned" | "pinned_at"> = nextPinned
          ? { pinned: true, pinned_at: new Date().toISOString() }
          : { pinned: false, pinned_at: null };

        const { error } = await supabase
          .from("conversations")
          .update(patch)
          .eq("id", convId)
          .eq("user_id", user.id);

        if (error) throw error;
      } catch (e) {
        console.error("Pin update failed:", e);
        // rollback
        setConversations((prev) => prev.map((c) => (c.id === convId ? conv : c)));
      }
    },
    [user, conversations]
  );

  // Delete finalize
  const finalizeDelete = useCallback(
    async (convId: string) => {
      if (!user) return;

      try {
        const { error: msgErr } = await supabase
          .from("messages")
          .delete()
          .eq("conversation_id", convId)
          .eq("user_id", user.id)
          .select("id");

        if (msgErr) throw msgErr;

        const { data: deletedConvs, error: convErr } = await supabase
          .from("conversations")
          .delete()
          .eq("id", convId)
          .eq("user_id", user.id)
          .select("id");

        if (convErr) throw convErr;

        if (!deletedConvs || deletedConvs.length === 0) {
          console.error("Conversation silinemedi (0 satır). RLS/policy veya user_id filtresi kaynaklı olabilir.", {
            convId,
            userId: user.id,
          });
          await fetchConversations(user);
          return;
        }

        if (currentConversationId === convId) {
          setCurrentConversationId(null);
          setMessages([]);
        }

        await fetchConversations(user);
      } catch (e) {
        console.error("Finalize delete failed:", e);
        await fetchConversations(user);
      }
    },
    [user, currentConversationId, fetchConversations]
  );

  // Undo flow
  const requestDeleteWithUndo = useCallback(
    (conv: Conversation) => {
      if (pendingDelete) {
        window.clearTimeout(pendingDelete.timeoutId);
        void finalizeDelete(pendingDelete.conv.id);
        setPendingDelete(null);
        setUndoBannerOpen(false);
      }

      const index = conversations.findIndex((c) => c.id === conv.id);
      if (index === -1) return;

      setConversations((prev) => prev.filter((c) => c.id !== conv.id));

      if (currentConversationId === conv.id) {
        setCurrentConversationId(null);
        setMessages([]);
      }

      setUndoBannerOpen(true);

      const startedAt = Date.now();
      const timeoutId = window.setTimeout(() => {
        setUndoBannerOpen(false);
        setPendingDelete(null);
        void finalizeDelete(conv.id);
      }, 5000);

      setPendingDelete({ conv, index, timeoutId, startedAt });
    },
    [pendingDelete, conversations, currentConversationId, finalizeDelete]
  );

  const undoDelete = useCallback(() => {
    if (!pendingDelete) return;

    window.clearTimeout(pendingDelete.timeoutId);

    setConversations((prev) => {
      const next = [...prev];
      const insertAt = Math.min(Math.max(pendingDelete.index, 0), next.length);
      next.splice(insertAt, 0, pendingDelete.conv);
      return next;
    });

    setUndoBannerOpen(false);
    setPendingDelete(null);
  }, [pendingDelete]);

  const dismissUndoAndFinalizeNow = useCallback(() => {
    if (!pendingDelete) return;

    window.clearTimeout(pendingDelete.timeoutId);
    setUndoBannerOpen(false);
    setPendingDelete(null);

    void finalizeDelete(pendingDelete.conv.id);
  }, [pendingDelete, finalizeDelete]);

  const openDeleteConfirm = useCallback((conv: Conversation) => {
    setOpenMenuForId(null);
    setDeleteTarget(conv);
    setDeleteConfirmOpen(true);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }, []);

  const confirmDeleteFromModal = useCallback(() => {
    if (!deleteTarget) return;
    closeDeleteConfirm();
    requestDeleteWithUndo(deleteTarget);
  }, [deleteTarget, closeDeleteConfirm, requestDeleteWithUndo]);

  // textarea auto-resize
  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    const maxHeight = 220;
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    autoResizeTextarea();
  }, [input, autoResizeTextarea]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      const currentUser = user;
      const userInput = input.trim();
      if (!currentUser || !userInput || isGenerating) return;

      setIsGenerating(true);

      const userMessage: Message = { role: "user", content: userInput };
      const currentMessages = [...messages, userMessage];
      setMessages(currentMessages);
      setInput("");
      setTimeout(() => autoResizeTextarea(), 0);

      let convId = currentConversationId;
      const isNewChat = !convId;

      try {
        if (isNewChat) {
          const { data, error } = await supabase
            .from("conversations")
            .insert({ user_id: currentUser.id })
            .select("id, title, created_at, pinned, pinned_at")
            .single();

          if (error) throw new Error(`Konuşma oluşturulamadı: ${error.message}`);

          convId = data.id;
          setCurrentConversationId(convId);
          setConversations((prev) => [data as Conversation, ...prev]);
        }

        if (!convId) throw new Error("Sohbet ID'si bulunamadı.");

        await supabase.from("messages").insert({
          user_id: currentUser.id,
          conversation_id: convId,
          role: "user",
          content: userInput,
        });

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Kullanıcı oturumu bulunamadı.");

        const workerUrl = process.env.NEXT_PUBLIC_AI_WORKER_URL;
        if (!workerUrl) throw new Error("NEXT_PUBLIC_AI_WORKER_URL tanımlı değil.");

        const cfMessages = currentMessages.map((m) => ({
          role: m.role === "model" ? "assistant" : "user",
          content: m.content,
        }));

        const response = await fetch(workerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: cfMessages }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`AI hatası (status ${response.status}): ${errText}`);
        }

        const data = await response.json();

        const fullResponse =
          (typeof data?.answer === "string" && data.answer) ||
          (typeof data?.response === "string" && data.response) ||
          "";

        const titleFromWorker = (typeof data?.title === "string" && data.title) || null;

        setMessages((prev) => [...prev, { role: "model", content: fullResponse }]);

        await supabase.from("messages").insert({
          user_id: currentUser.id,
          conversation_id: convId,
          role: "model",
          content: fullResponse,
        });

        // Title: DB'de sadece ilk mesajda ayarla
        if (isNewChat) {
          const fallbackTitle =
            userInput
              .replace(/[\r\n]+/g, " ")
              .replace(/[“”"']/g, "")
              .trim()
              .split(/\s+/)
              .slice(0, 5)
              .join(" ")
              .trim() || "Yeni Sohbet";

          const finalTitle = (titleFromWorker && titleFromWorker.trim()) || fallbackTitle;

          setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, title: finalTitle } : c)));
          await supabase.from("conversations").update({ title: finalTitle }).eq("id", convId).eq("user_id", currentUser.id);
        }

        setTimeout(() => textareaRef.current?.focus(), 0);
      } catch (err: unknown) {
        console.error("handleSubmit içinde Hata:", err);
        const msg = err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu";
        setMessages((prev) => [...prev, { role: "model", content: `Üzgünüm, bir sorun oluştu: ${msg}` }]);
      } finally {
        setIsGenerating(false);
      }
    },
    [user, input, isGenerating, messages, currentConversationId, autoResizeTextarea]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }, []);

  // Sort: pinned first, then pinned_at desc, then created_at desc
  const sortedConversations = useMemo(() => {
    const copy = [...conversations];
    copy.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

      const ap = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
      const bp = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
      if (ap !== bp) return bp - ap;

      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      return bt - at;
    });
    return copy;
  }, [conversations]);

  if (!user) {
    return <div className="flex h-screen w-full items-center justify-center bg-background" />;
  }

  const mobileToggleTransform = isSidebarOpen ? "translateX(calc(18rem + 0.75rem))" : "translateX(0px)";

  return (
    <div className="relative min-h-screen bg-background text-foreground font-[family-name:var(--font-geist-sans)]">
      <div
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden ${
          isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col",
          sidebarWidthClass,
          "bg-zinc-950/80 backdrop-blur-xl border-r border-zinc-800/80",
          "shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-label="Sohbet kenar çubuğu"
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800/70 px-3 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">Sohbetler</div>
              <div className="text-xs text-zinc-400 truncate">{displayName}</div>
            </div>

            <button
              onClick={handleNewChat}
              className="rounded-full bg-zinc-800/70 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700/70 transition-colors"
            >
              + Yeni
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar" ref={menuContainerRef}>
            {sortedConversations.length === 0 ? (
              <div className="px-2 py-3 text-sm text-zinc-400">Henüz sohbet yok. “+ Yeni” ile başlayabilirsin.</div>
            ) : (
              <div className="space-y-1">
                {sortedConversations.map((conv) => {
                  const active = currentConversationId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      className={[
                        "relative flex items-stretch gap-1 rounded-lg",
                        active ? "bg-zinc-800/70 border border-zinc-700/60" : "border border-transparent",
                      ].join(" ")}
                    >
                      <button
                        onClick={() => handleConversationSelect(conv.id)}
                        className={[
                          "flex-1 min-w-0 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          active ? "text-white" : "hover:bg-zinc-900/60 text-zinc-200",
                        ].join(" ")}
                        title={conv.title ?? "Başlıksız Sohbet"}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {conv.pinned && (
                            <span className="shrink-0 text-zinc-300" title="Sabitlendi">
                              <PinIcon className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <div className="truncate">{conv.title ?? "Başlıksız Sohbet"}</div>
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-500 truncate">
                          {new Date(conv.created_at).toLocaleString()}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenMenuForId((prev) => (prev === conv.id ? null : conv.id));
                        }}
                        className={[
                          "shrink-0 rounded-lg px-2 text-zinc-300 hover:text-white",
                          "hover:bg-zinc-900/60 transition-colors",
                        ].join(" ")}
                        aria-label="Sohbet seçenekleri"
                        title="Seçenekler"
                      >
                        <DotsIcon />
                      </button>

                      {openMenuForId === conv.id && (
                        <div
                          className="absolute right-2 top-12 z-50 w-44 rounded-xl border border-zinc-800/70 bg-zinc-950/95 backdrop-blur shadow-2xl overflow-hidden"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={async () => {
                              await togglePin(conv.id);
                              setOpenMenuForId(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900/70 flex items-center gap-2"
                          >
                            <PinIcon className="h-4 w-4" />
                            {conv.pinned ? "Sabitlemeyi kaldır" : "Sohbeti sabitle"}
                          </button>

                          <button
                            type="button"
                            onClick={() => openRename(conv)}
                            className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900/70"
                          >
                            İsmini değiştir
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteConfirm(conv)}
                            className="w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
                          >
                            Sil
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800/70 p-3 relative" ref={profileContainerRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className={[
                "w-full rounded-2xl px-3 py-3",
                "hover:bg-zinc-900/60 transition-colors",
                "flex items-center justify-start gap-3",
              ].join(" ")}
              aria-label="Profil menüsü"
            >
              <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-700 flex items-center justify-center text-white text-sm">
                {avatarLetter}
              </div>
              <div className="min-w-0 text-left">
                <div className="truncate text-sm font-medium text-zinc-100">{displayName}</div>
              </div>
            </button>

            {profileOpen && (
              <div
                className="absolute left-3 right-3 bottom-20 z-50 rounded-2xl border border-zinc-800/70 bg-zinc-950/95 backdrop-blur shadow-2xl overflow-hidden"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-zinc-700 flex items-center justify-center text-white text-sm">
                      {avatarLetter}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                      <div className="truncate text-xs text-zinc-400">{displayEmail}</div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-zinc-800/70" />

                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => setProfileOpen(false)}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900/70 flex items-center gap-2"
                  >
                    <SettingsIcon />
                    Ayarlar
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10 flex items-center gap-2"
                  >
                    <LogoutIcon />
                    Çıkış yap
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <button
        onClick={() => setIsSidebarOpen((v) => !v)}
        className={[
          "fixed top-4 left-4 z-50 lg:hidden",
          "rounded-full border border-zinc-700/70 bg-zinc-950/80 backdrop-blur",
          "p-2 text-white shadow-lg",
          "hover:bg-zinc-900/80 transition-colors",
          "transition-transform duration-300 ease-in-out",
        ].join(" ")}
        style={{ transform: mobileToggleTransform }}
        aria-label="Kenar çubuğunu aç/kapat"
      >
        <SidebarToggleIcon isOpen={isSidebarOpen} />
      </button>

      <div className={`relative ${sidebarPaddingLeftDesktop}`}>
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-3 pt-16 sm:px-6 lg:px-10">
          <div className="flex-1">
            <div className="h-[calc(100vh-10.5rem)] sm:h-[calc(100vh-10.75rem)] overflow-y-auto rounded-2xl border border-zinc-800/70 bg-background/70 backdrop-blur p-4 sm:p-6 shadow-lg custom-scrollbar">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-zinc-500">
                  Sohbeti başlatmak için bir mesaj gönderin.
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, index) => {
                    const isUserMsg = msg.role === "user";
                    return (
                      <div key={index} className={`flex ${isUserMsg ? "justify-end" : "justify-start"}`}>
                        <div
                          className={[
                            "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3",
                            isUserMsg
                              ? "bg-blue-600 text-white"
                              : "bg-zinc-900/70 border border-zinc-800/60 text-zinc-100",
                          ].join(" ")}
                        >
                          {isUserMsg ? (
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          ) : (
                            <AnimatedStream text={msg.content} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-800/70 bg-background/70 backdrop-blur p-3 sm:p-4 shadow-lg">
            <form onSubmit={handleSubmit} className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Yapay zekaya bir mesaj yaz…"
                rows={1}
                className={[
                  "flex-1 resize-none rounded-2xl custom-scrollbar",
                  "bg-zinc-900/70 border border-zinc-800/70",
                  "px-4 py-2.5 text-sm sm:text-base leading-6 text-zinc-100",
                  "placeholder:text-zinc-500",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500/70",
                ].join(" ")}
                disabled={isGenerating}
              />

              <button
                type="submit"
                disabled={!canSend}
                className={[
                  "h-11 w-11 p-0 sm:w-auto sm:px-4",
                  "rounded-2xl",
                  "bg-blue-600 text-white font-medium",
                  "hover:bg-blue-700 transition-colors",
                  "disabled:bg-zinc-700 disabled:text-zinc-300 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2",
                ].join(" ")}
                aria-label="Gönder"
                title="Gönder"
              >
                {isGenerating ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.3" />
                      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" fill="none" />
                    </svg>
                    <span className="hidden sm:inline">Gönderiliyor</span>
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m22 2-7 20-4-9-9-4Z" />
                      <path d="M22 2 11 13" />
                    </svg>
                    <span className="hidden sm:inline">Gönder</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="h-6" />
        </div>
      </div>

      {undoBannerOpen && pendingDelete && (
        <div className="fixed bottom-4 left-4 right-4 z-[70] lg:left-80 lg:right-auto">
          <div className="max-w-md rounded-2xl border border-zinc-800/70 bg-zinc-950/95 backdrop-blur px-4 py-3 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-zinc-200 truncate">Sohbet silindi.</div>
                <div className="text-xs text-zinc-500 truncate">{pendingDelete.conv.title ?? "Başlıksız Sohbet"}</div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={undoDelete}
                  className="rounded-xl bg-zinc-800/70 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700/70 transition-colors"
                >
                  Geri al
                </button>

                <button
                  type="button"
                  onClick={dismissUndoAndFinalizeNow}
                  className="h-8 w-8 rounded-xl bg-zinc-800/50 text-zinc-200 hover:bg-zinc-700/60 hover:text-white transition-colors flex items-center justify-center"
                  aria-label="Geri alma bildirimi kapat ve işlemi hemen uygula"
                  title="Kapat"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-3 h-1 w-full rounded-full bg-zinc-800/70 overflow-hidden">
              <div
                key={pendingDelete.startedAt}
                className="h-full w-full rounded-full bg-zinc-200/80 origin-left animate-[shrink_5s_linear_forwards]"
              />
            </div>
          </div>
        </div>
      )}

      {deleteConfirmOpen && deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800/70 bg-zinc-950/90 backdrop-blur p-4 shadow-2xl">
            <div className="text-sm font-semibold text-white">Sohbeti sil?</div>
            <div className="mt-2 text-sm text-zinc-400">
              <span className="text-zinc-200 font-medium">“{deleteTarget.title ?? "Başlıksız Sohbet"}”</span> silinecek.
              <br />
              Bu sohbeti silmek istediğinize emin misiniz?
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="rounded-xl px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-900/60"
              >
                İptal
              </button>

              <button
                type="button"
                onClick={confirmDeleteFromModal}
                className="rounded-xl bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {renameModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800/70 bg-zinc-950/90 backdrop-blur p-4 shadow-2xl">
            <div className="text-sm font-semibold text-white">Sohbet adını değiştir</div>

            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!isRenaming && renameValue.trim()) void submitRename();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  if (!isRenaming) closeRename();
                }
              }}
              className="mt-3 w-full rounded-xl bg-zinc-900/70 border border-zinc-800/70 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              placeholder="Yeni sohbet adı"
              autoFocus
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeRename}
                className="rounded-xl px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-900/60"
                disabled={isRenaming}
              >
                İptal
              </button>

              <button
                type="button"
                onClick={submitRename}
                disabled={isRenaming || !renameValue.trim()}
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-300"
              >
                {isRenaming ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes shrink {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }

        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.18) rgba(0, 0, 0, 0.25);
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.25);
          border-radius: 999px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          border: 2px solid rgba(0, 0, 0, 0.25);
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.26);
        }
      `}</style>
    </div>
  );
}