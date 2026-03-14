"use client";

import { useEffect, useState } from "react";

export interface ToastMessage {
  id: string;
  type: "success" | "error";
  message: string;
  thumbnail?: string;
}

interface ToastProps {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function Toast({ messages, onDismiss }: ToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {messages.map((msg) => (
        <ToastItem key={msg.id} message={msg} onDismiss={() => onDismiss(msg.id)} />
      ))}
    </div>
  );
}

function ToastItem({ message, onDismiss }: { message: ToastMessage; onDismiss: () => void }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));

    // Auto dismiss after 3 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const bgColor = message.type === "success" ? "bg-green-600" : "bg-red-600";

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white
        transition-all duration-300 transform
        ${bgColor}
        ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
    >
      {message.thumbnail && (
        <img
          src={message.thumbnail}
          alt="upload preview"
          className="w-10 h-10 rounded object-cover border border-white/30"
        />
      )}
      <span className="text-sm font-medium">{message.message}</span>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onDismiss, 300);
        }}
        className="ml-2 text-white/70 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
