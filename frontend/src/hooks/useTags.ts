import { useQuery } from "@tanstack/react-query";
import { fetchTags } from "../api/tags";

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: fetchTags,
    staleTime: 5 * 60 * 1000,
  });
}
