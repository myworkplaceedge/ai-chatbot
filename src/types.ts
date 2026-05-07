export type ChatRole = "user" | "assistant";

export type Handout = {
  title: string;
  url?: string;
};

export type ChatMessageType = {
  role: ChatRole;
  content: string;
  timestamp: Date;
  followUp?: string;
  messageId?: string;
  rating?: "thumbs_up" | "thumbs_down";
  handout?: Handout;
};

export type Lesson = {
  id: string;
  name: string;
  createdAt: string;
};

export type ToastType = "success" | "error";
