import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = {
  id: string;
  user_id: string;
  sender: "customer" | "admin";
  body: string;
  image_url: string | null;
  image_path: string | null;
  is_read: boolean;
  created_at: string;
};

/** The signed-in customer's conversation with the store. */
export const myChatQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["chat", userId ?? "anon"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });

/** Every conversation (admin view). */
export const allChatsQuery = queryOptions({
  queryKey: ["chat-inbox"],
  queryFn: async (): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(2000);
    if (error) throw error;
    return (data ?? []) as ChatMessage[];
  },
});
