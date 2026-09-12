export const BOT_REPLY_DELAY_MS = 900;

export const PRIMARY_ACTION_OPTIONS = [
  "Prices & Floor Plans 💸",
  "Best Deal Today 💰",
  "Book A Site Visit 🚁",
  "Request A Callback 📞",
] as const;

export const CONFIGURATION_OPTIONS = [
  "1 BHK",
  "2 BHK",
  "3 BHK",
  "4 BHK",
  "Other Size",
  "Exploring Options",
] as const;

export type ChatStage =
  | "idle"
  | "await_intent"
  | "await_configuration"
  | "await_contact"
  | "submitting"
  | "done";

export interface ChatAnswers {
  intent: string;
  configuration: string;
  name: string;
  phone: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: "bot" | "user";
}
