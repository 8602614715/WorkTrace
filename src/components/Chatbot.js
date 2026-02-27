import { useEffect, useRef, useState } from 'react';
import { chatbotAPI } from '../services/api';
import './Chatbot.css';

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: 'Hello! I can help you manage your tasks.', type: 'bot' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleChatbot = () => {
    setIsOpen((prev) => !prev);
  };

  const closeChatbot = () => {
    setIsOpen(false);
  };

  const addMessage = (text, type = 'bot') => {
    setMessages((prev) => [...prev, { text, type }]);
  };

  const sendChat = async () => {
    const msg = input.trim();
    if (!msg || sending) return;

    addMessage(msg, 'user');
    setInput('');
    setSending(true);

    try {
      const data = await chatbotAPI.chat(msg);
      addMessage(data.reply || "Sorry, I didn't understand that.", 'bot');
    } catch (err) {
      console.error('Chat error:', err);
      if (err?.status === 401) {
        addMessage('You are not authenticated. Please log in and try again.', 'bot');
      } else {
        addMessage(err.message || 'An error occurred. Please try again.', 'bot');
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendChat();
    }
  };

  return (
    <>
      <div id="chatbot-bubble" onClick={toggleChatbot} title="Open assistant">
        AI
      </div>

      {isOpen && (
        <div id="chatbot-window">
          <div className="chatbot-header">
            Assistant
            <span className="chatbot-close" onClick={closeChatbot}>
              X
            </span>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={msg.type === 'user' ? 'user-message' : 'bot-message'}
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {msg.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-input-area">
            <input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sending}
            />
            <button onClick={sendChat} disabled={sending}>
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
