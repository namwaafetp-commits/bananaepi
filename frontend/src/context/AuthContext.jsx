import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading, null = logged out

  useEffect(() => {
    // Get initial session (also handles magic-link / OAuth hash on first load)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  /** Send a magic-link / OTP to email (creates account if new user) */
  const signInWithMagicLink = (email) =>
    supabase.auth.signInWithOtp({
      email,
      options: {
        // After clicking the link, redirect back to the app root
        emailRedirectTo: window.location.origin + '/',
        // Create account automatically if the email is new
        shouldCreateUser: true,
      },
    })

  /** Start Google OAuth flow (redirects away then back) */
  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/',
      },
    })

  const signOut = () => supabase.auth.signOut()

  const accessToken = session?.access_token ?? null

  return (
    <AuthContext.Provider value={{ session, accessToken, signInWithMagicLink, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
