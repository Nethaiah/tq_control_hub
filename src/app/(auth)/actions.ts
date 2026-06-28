"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import type { User } from "@supabase/supabase-js"
import type { z } from "zod"

import { ensureProfileForUser, getOrganizationContextForUser } from "@/lib/api/auth"
import {
  loginFormSchema,
  signupFormSchema,
  type LoginFormValues,
  type SignupFormValues,
} from "@/lib/api/auth-schemas"
import { createClient } from "@/lib/supabase/server"

export type AuthActionResult =
  | { ok: true }
  | { ok: false; error: string }

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

function parseAuthInput<T extends z.ZodType>(schema: T, input: FormData | z.input<T>): z.output<T> | { ok: false; error: string } {
  const result = schema.safeParse(input instanceof FormData ? formDataToObject(input) : input)

  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Invalid form submission" }
  }

  return result.data
}

async function redirectAfterAuth(user: User) {
  await ensureProfileForUser(user)

  const context = await getOrganizationContextForUser(user)

  revalidatePath("/", "layout")
  redirect(context.membership ? "/dashboard" : "/pending-access")
}

export async function loginAction(input: FormData | LoginFormValues): Promise<AuthActionResult> {
  const parsed = parseAuthInput(loginFormSchema, input)
  if ("ok" in parsed) return parsed

  const { email, password } = parsed
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !user) {
    return { ok: false, error: error?.message ?? "Unable to sign in" }
  }

  await redirectAfterAuth(user)
  return { ok: true }
}

export async function signupAction(input: FormData | SignupFormValues): Promise<AuthActionResult> {
  const parsed = parseAuthInput(signupFormSchema, input)
  if ("ok" in parsed) return parsed

  const { email, fullName, password } = parsed
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
    error,
  } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || email.split("@")[0],
      },
    },
  })

  if (error || !user) {
    return { ok: false, error: error?.message ?? "Unable to create account" }
  }

  await redirectAfterAuth(user)
  return { ok: true }
}

export async function logoutAction() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
