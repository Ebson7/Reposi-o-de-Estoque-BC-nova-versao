
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Search, ShoppingCart, Trash2, Mic, MicOff } from 'lucide-react';
import { Product, ChatMessage } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

interface ChatPortalProps {
  products: Product[];
  chatHistory: ChatMessage[];
  onSendMessage: (message: string, results?: Product[]) => void;
  onClearHistory: () => void;
  onSelectProduct: (product: Product) => void;
}

export const ChatPortal: React.FC<ChatPortalProps> = ({ 
  products, 
  chatHistory, 
  onSendMessage, 
  onClearHistory,
  onSelectProduct
}) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'pt-BR';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (error) {
          console.error('Failed to start recognition:', error);
          // Sometimes it errors if already started or state is weird
          setIsListening(false);
        }
      } else {
        alert('Seu navegador não suporta reconhecimento de voz.');
      }
    }
  };

  // Initialize Gemini
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    onSendMessage(userMessage);
    setIsTyping(true);

    try {
      // Step 1: Use Gemini to identify if the user is searching for products and extract keywords
      const result = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: 'user',
            parts: [{ text: `O usuário disse: "${userMessage}". 
            Se ele estiver pedindo para listar ou procurar produtos, extraia os termos de busca (palavras-chave).
            Responda APENAS em JSON com o seguinte formato:
            {
              "isSearch": boolean,
              "keywords": string[],
              "response": string (Uma resposta curta e amigável confirmando a busca ou respondendo à dúvida)
            }` }]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isSearch: { type: Type.BOOLEAN },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              response: { type: Type.STRING }
            },
            required: ["isSearch", "keywords", "response"]
          }
        }
      });

      const text = result.text;
      if (!text) {
        throw new Error("No response text from Gemini");
      }
      const data = JSON.parse(text);
      let foundProducts: Product[] = [];

      if (data.isSearch && data.keywords.length > 0) {
        // Step 2: Local search in the products list
        foundProducts = products.filter(p => {
          const searchSpace = `${p.produto} ${p.sabor} ${p.fornecedor} ${p.codigo}`.toLowerCase();
          return data.keywords.some((kw: string) => searchSpace.includes(kw.toLowerCase()));
        });
      }

      onSendMessage(data.response || "Aqui está o que encontrei:", foundProducts);
    } catch (error) {
      console.error("Gemini Chat Error:", error);
      onSendMessage("Desculpe, tive um problema ao processar sua solicitação.");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-4">
      <div className="p-4 border-b border-gray-50 dark:border-slate-800 flex justify-between items-center bg-gray-50/30 dark:bg-slate-800/20">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black dark:text-white uppercase tracking-wider">Assistente Marsil</h3>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[9px] text-gray-400 font-bold uppercase">Online e Pronto</p>
            </div>
          </div>
        </div>
        <button 
          onClick={onClearHistory}
          className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
          title="Limpar Conversa"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Limpar Chat</span>
        </button>
      </div>

      <div 
        ref={scrollRef}
        className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/50"
      >
        {chatHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-40">
            <Sparkles className="w-12 h-12 mb-4 text-blue-500" />
            <p className="text-sm font-black uppercase tracking-widest dark:text-white">Olá! Como posso ajudar?</p>
            <p className="text-[10px] font-bold uppercase mt-2">Tente dizer: "Liste todos os Snickers"</p>
          </div>
        )}

        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'order-2' : ''}`}>
              <div className={`p-4 rounded-3xl text-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-600/20' 
                  : 'bg-white dark:bg-slate-800 dark:text-slate-100 rounded-tl-none shadow-sm border border-gray-100 dark:border-slate-700'
              }`}>
                <p className="font-medium">{msg.content}</p>
                
                {msg.results && msg.results.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 dark:border-slate-700 pt-3">
                    <p className="text-[9px] font-black uppercase opacity-60">Produtos encontrados:</p>
                    {msg.results.map(p => (
                      <div 
                        key={p.id} 
                        className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 gap-2 cursor-pointer hover:border-blue-500 transition-all"
                        onClick={() => onSelectProduct(p)}
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] font-black dark:text-white truncate uppercase">{p.produto}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            <span className="text-[8px] bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1 rounded uppercase font-black">#{p.codigo}</span>
                            {p.sabor && <span className="text-[8px] bg-pink-50 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400 px-1 rounded uppercase font-black">{p.sabor}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[8px] text-gray-400 font-bold uppercase">{p.fornecedor}</p>
                            <span className="text-[8px] font-black text-slate-700 dark:text-slate-300 uppercase">SP: {p.estoqueMarsil}</span>
                            <span className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase">BC: {p.estoqueBoraceia}</span>
                          </div>
                        </div>
                        <ShoppingCart className="w-3 h-3 text-blue-600 shrink-0" />
                      </div>
                    ))}
                    {msg.results.length > 20 && (
                      <p className="text-[8px] text-center text-gray-400 font-bold italic mt-1">Exibindo muitos resultados, tente ser mais específico se necessário.</p>
                    )}
                  </div>
                )}
                {msg.role === 'assistant' && msg.results && msg.results.length === 0 && msg.content.includes("encontrei") && (
                   <p className="mt-2 text-[10px] text-red-500 font-bold italic uppercase">Nenhum produto correspondente encontrado.</p>
                )}
              </div>
              <p className="text-[8px] font-black uppercase text-gray-400 mt-1 px-2">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start animate-in fade-in transition-all">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl rounded-tl-none shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <p className="text-[10px] font-black uppercase text-gray-400">Analisando...</p>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-gray-50 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="relative flex items-center gap-2">
          <button 
            type="button"
            onClick={toggleListening}
            className={`p-3 rounded-xl transition-all ${
              isListening 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 hover:text-blue-600'
            }`}
            title={isListening ? "Parar de ouvir" : "Falar"}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <input 
            type="text" 
            placeholder={isListening ? "Ouvindo..." : "Pergunte algo ao assistente..."} 
            className="flex-grow pl-5 pr-14 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 dark:text-white outline-none border-2 border-transparent focus:border-blue-500 transition-all font-medium text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isTyping}
            className="absolute right-2 p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/30 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
