export interface ChatChannel {
  id: string;
  system?: "publico" | "interno";
  label?: "trabajador" | "subcontrato" | "cliente";
  participantType?: "employee" | "subcontractor" | "client";
  participantId?: string;
  participantName?: string | null;
  participantAvatarUrl?: string | null;
  status: "invitado" | "activo";
  controlMode?: "bot" | "human";
  disappearingDuration: "24h" | "72h" | "nunca";
  pinned?: boolean;
  archived?: boolean;
  lastMessage: string | null;
  lastMessageAt?: string | null;
}

export interface ChatMessage {
  id: string;
  senderType: "admin" | "employee" | "subcontractor" | "client" | "bot";
  senderId?: string | null;
  content: string;
  timestamp: string;
}

export interface DirectoryContact {
  participantType: "employee" | "subcontractor" | "client";
  participantId: string;
  name: string;
  avatarUrl: string | null;
}
