import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { clearMobileTokens, getMobileTokens, isNativeMobile } from "@/lib/mobileAuth";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  // Login is started via startLogin() in the effect below, only when we actually
  // navigate — never during render. startLogin() mints a one-time nonce + writes
  // the state cookie, so calling it per render would overwrite the cookie and
  // desync it from an in-flight login's `state`.
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });
  const mobileLogoutMutation = trpc.auth.mobileLogout.useMutation();

  const logout = useCallback(async () => {
    try {
      if (isNativeMobile()) {
        const tokens = await getMobileTokens();
        if (tokens) await mobileLogoutMutation.mutateAsync({ refreshToken: tokens.refreshToken });
        await clearMobileTokens();
      } else {
        await logoutMutation.mutateAsync();
      }
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, mobileLogoutMutation, utils]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending || mobileLogoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? mobileLogoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
    mobileLogoutMutation.error,
    mobileLogoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    const destination = redirectPath ?? "/masuk";
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`${destination}${destination.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}`);
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
