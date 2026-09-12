import { createRoot } from "react-dom/client";
import { mergeChatConfig, type ChatConfig } from "./lib/config";
import { ChatWidget } from "./components/ChatWidget";
import "./styles/chat-widget.css";
import "./styles/premium.css";
import "./styles/mobile-open.css";
import "./styles/root.css";

export interface MountOptions extends Partial<ChatConfig> {
  embedded?: boolean;
}

function mount(container: HTMLElement, options: MountOptions = {}): () => void {
  const { embedded = true, ...configOverrides } = options;
  const cfg = mergeChatConfig(configOverrides);

  const root = createRoot(container);
  root.render(<ChatWidget config={cfg} embedded={embedded} />);

  return () => {
    root.unmount();
  };
}

declare global {
  interface Window {
    LeadEstateChat?: { mount: typeof mount };
  }
}

window.LeadEstateChat = { mount };

export { mount, ChatWidget };
