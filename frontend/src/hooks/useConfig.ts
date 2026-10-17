import { useQuery } from '@tanstack/react-query'
import { publicApi, queryKeys } from '@/services'

/** Server-side booking rules, "today" and time zone. The server clock is the source of truth for dates. */
export function useConfig() {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: publicApi.config,
    staleTime: 5 * 60 * 1000,
  })
}

export function useAmenities() {
  return useQuery({
    queryKey: queryKeys.amenities,
    queryFn: publicApi.amenities,
    staleTime: 30 * 60 * 1000,
  })
}
