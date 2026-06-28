import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const { supabase, response } = createClient(request)

  // Refresh session if expired. Required for Server Components to read fresh auth state.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (framework assets)
     * - favicon.ico, image files
     * - /api/* (API routes handle auth themselves)
     * - /login, /signup, /pending-access, /logout (auth pages don't need session refresh)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/|login|signup|pending-access|logout).*)',
  ],
}
