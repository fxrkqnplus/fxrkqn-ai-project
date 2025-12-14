"use client";

import { useEffect, useState, FormEvent, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import AnimatedStream from '@/components/AnimatedStream';

// Tipleri tanımlıyoruz
interface Message {
    role: 'user' | 'model';
    content: string;
}
interface Conversation {
    id: string;
    created_at: string;
    title: string | null;
}

// Kenar çubuğu açma/kapama butonu için basit bir ikon komponenti
const SidebarToggleIcon = ({ isOpen }: { isOpen: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{
                  transform: isOpen ? 'none' : 'rotate(180deg)',
                  transition: 'transform 0.3s ease-in-out'
              }}/>
    </svg>
);

export default function ChatPage() {
    // State Değişkenleri
    const [user, setUser] = useState<User | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false); // 3. madde için: gönderme kilidi / yüklenme durumu

    const router = useRouter();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchConversations = useCallback(async (user: User | null) => {
      if (!user) return;

      const { data, error } = await supabase
        .from('conversations')
        .select('id, created_at, title')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Sohbetler çekilemedi:', error);
      } else {
        setConversations(data || []);
      }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (!session) {
          router.push('/');
          return;
        }
        const currentUser = session.user;
        setUser(currentUser);
        fetchConversations(currentUser);
      });

      // initial check (in case onAuthStateChange not fired immediately)
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/'); return; }
        setUser(session.user);
        fetchConversations(session.user);
      })();

      return () => {
        authListener.subscription.unsubscribe();
      };
    }, [router, fetchConversations]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const handleNewChat = () => {
        setMessages([]);
        setCurrentConversationId(null);
    };

    const handleConversationSelect = async (convId: string) => {
        setCurrentConversationId(convId);
        setMessages([]);
        const { data, error } = await supabase
            .from('messages')
            .select('role, content')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Mesajlar çekilemedi:', error);
        } else {
            // veritabanından gelen role string'leri 'user'|'model' biçiminde bekliyoruz
            setMessages((data as Message[]) || []);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const currentUser = user;
    if (!input.trim() || !currentUser) return;

    setIsGenerating(true);

    const userMessage: Message = { role: 'user', content: input };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    const userInput = input;
    setInput('');

    let convId = currentConversationId;
    const isNewChat = !convId;

    try {
        if (isNewChat) {
            const { data, error } = await supabase
              .from('conversations')
              .insert({ user_id: currentUser.id })
              .select('id, title, created_at')
              .single();
            if (error) throw new Error(`Konuşma oluşturulamadı: ${error.message}`);
            convId = data.id;
            setCurrentConversationId(convId);
            setConversations(prev => [{ id: convId!, created_at: data.created_at, title: data.title }, ...prev]);
        }

        if (!convId) throw new Error("Sohbet ID'si bulunamadı.");

        await supabase.from('messages').insert({ user_id: currentUser.id, conversation_id: convId, role: 'user', content: userInput });

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Kullanıcı oturumu bulunamadı.");
        const userAccessToken = session.access_token;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        const response = await fetch(`${supabaseUrl}/functions/v1/ask-gemini`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userAccessToken}` },
            body: JSON.stringify({ messages: currentMessages }),
        });

        if (!response.ok || !response.body) throw new Error(`Sunucu hatası (status ${response.status})`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";
        setMessages(prev => [...prev, { role: 'model', content: "" }]);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullResponse += decoder.decode(value, { stream: true });
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].content = fullResponse;
                return newMessages;
            });
        }

        await supabase.from('messages').insert({ user_id: currentUser.id, conversation_id: convId, role: 'model', content: fullResponse });

        if (isNewChat) {
            try {
                const genRes = await supabase.functions.invoke('generate-title', { body: { firstMessage: userInput } });
                console.log('generate-title raw response ->', genRes);

                let titleFromRes: string | null = null;
                if (genRes?.data?.title) titleFromRes = genRes.data.title;
                else if (typeof genRes?.data === 'string') titleFromRes = genRes.data;
                else if (genRes?.data?.body) titleFromRes = genRes.data.body;

                let finalTitle: string;
                if (typeof titleFromRes === 'string' && titleFromRes.trim().length > 0) finalTitle = titleFromRes.trim();
                else {
                    const fallback = userInput.replace(/[\r\n]+/g, ' ').split(/[.?!]/)[0].split(/\s+/).slice(0, 6).join(' ').trim();
                    finalTitle = fallback || new Date().toISOString();
                    console.warn('generate-title returned empty; using fallback:', finalTitle);
                }

                setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: finalTitle } : c));

                /** Güvenli update: return updated row **/
                const { data: updated, error: updateError } = await supabase
                    .from('conversations')
                    .update({ title: finalTitle })
                    .eq('id', convId)
                    .select('id, title, created_at')
                    .single();

                console.log('generate-title update response ->', { updated, updateError });

                if (updateError || !updated) {
                    console.error('Conversation title update failed or returned no row:', updateError, updated);
                    // Retry fallback
                    try {
                        const { data: updated2, error: updateError2 } = await supabase
                            .from('conversations')
                            .update({ title: finalTitle })
                            .eq('id', convId)
                            .select('id, title, created_at')
                            .single();
                        console.log('retry update result ->', { updated2, updateError2 });
                        if (updated2) setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: updated2.title } : c));
                        else await fetchConversations(currentUser);
                    } catch (e) {
                        console.error('Retry update exception:', e);
                        await fetchConversations(currentUser);
                    }
                } else {
                    setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: updated.title } : c));
                }

            } catch (gtErr: unknown) {
                console.error('generate-title invocation failed:', gtErr);
                const fallback = userInput.replace(/[\r\n]+/g, ' ').split(/[.?!]/)[0].split(/\s+/).slice(0, 6).join(' ').trim();
                try {
                    setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: fallback } : c));
                    await supabase.from('conversations').update({ title: fallback || new Date().toISOString() }).eq('id', convId);
                    await fetchConversations(currentUser);
                } catch (fallbackErr) {
                    console.error('Fallback title update also failed:', fallbackErr);
                    await fetchConversations(currentUser);
                }
            }
        }

        } catch (error: unknown) {
            console.error("handleSubmit içinde Hata:", error);
            const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
            setMessages(prev => [...prev, { role: 'model', content: `Üzgünüm, bir sorun oluştu: ${errorMessage}` }]);
        } finally {
            setIsGenerating(false);
        }
    };

    if (!user) {
        return <div className="flex h-screen w-full items-center justify-center bg-background"></div>;
    }

      return (
    <div className="flex h-screen bg-background text-foreground font-[family-name:var(--font-geist-sans)]">
      <aside className={`flex flex-col bg-zinc-900/50 border-r border-zinc-800 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64 p-4' : 'w-0 p-0 border-none'}`}>
        <div className={`flex flex-col h-full overflow-hidden transition-opacity duration-200 ${!isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <button onClick={handleNewChat} className="flex-shrink-0 w-full text-left p-2 rounded hover:bg-zinc-700 transition-colors whitespace-nowrap">
            + Yeni Sohbet
          </button>

          <div className="mt-3 px-2">
            <div className="text-xs text-zinc-400 mb-2">Sohbetler</div>
          </div>

          <div className="flex-grow mt-1 overflow-y-auto space-y-1 px-2">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => handleConversationSelect(conv.id)}
                className={`w-full text-left p-2 rounded text-sm truncate transition-colors ${currentConversationId === conv.id ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`}
              >
                {conv.title ?? 'Başlıksız Sohbet'}
              </button>
            ))}
          </div>

          <div className="flex-shrink-0 border-t border-zinc-700 pt-4 px-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white text-xs">
                {user?.email?.charAt(0).toUpperCase() ?? 'U'}
              </div>
              <div className="truncate">{user?.user_metadata?.full_name ?? user?.email}</div>
            </div>
            <button onClick={handleLogout} className="text-zinc-400 hover:text-white transition-colors w-full text-left mt-2 whitespace-nowrap">
              Oturumu Kapat
            </button>
          </div>
        </div>
      </aside>
          <div className="relative flex-1">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="absolute top-1/2 -translate-y-1/2 -left-3 z-10 p-1 bg-zinc-800 hover:bg-zinc-700 rounded-full border border-zinc-700 text-white transition-all">
                  <SidebarToggleIcon isOpen={isSidebarOpen} />
              </button>
              <main className="flex flex-col h-screen">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {messages.length === 0 && (
                          <div className="flex h-full items-center justify-center text-zinc-500">
                              <p>Sohbeti başlatmak için bir mesaj gönderin.</p>
                          </div>
                      )}
                      {messages.map((msg, index) => (
                          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-xl px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-800'}`}>
                                  {msg.role === 'user' ? (
                                      <p className="whitespace-pre-wrap font-mono">{msg.content}</p>
                                  ) : (
                                      // 2) burada AnimatedStream 'yazıyor' animasyonunu içeriyor;
                                      // AnimatedStream içindeki davranışa göre üç nokta animasyonu gösterebilirsin.
                                      <AnimatedStream text={msg.content} />
                                  )}
                              </div>
                          </div>
                      ))}
                      <div ref={messagesEndRef} />
                  </div>
                  <div className="border-t border-zinc-800 p-4 bg-background">
                      <form onSubmit={handleSubmit} className="flex items-center gap-4 max-w-4xl mx-auto">
                          <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Yapay zekaya bir mesaj gönder..."
                            className="flex-1 w-full px-4 py-2 bg-zinc-800 border-zinc-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isGenerating}
                          />
                          <button
                              type="submit"
                              className={`bg-blue-600 text-white rounded-full p-2 hover:bg-blue-700 disabled:bg-zinc-600 ${isGenerating ? 'opacity-75 pointer-events-none' : ''}`}
                              disabled={!input.trim() || isGenerating}
                          >
                              {/* Basit loading dönüşü için buton içinde dönen SVG koyabilirsin */}
                              {isGenerating ? (
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                              )}
                          </button>
                      </form>
                  </div>
              </main>
          </div>
      </div>
    );
}