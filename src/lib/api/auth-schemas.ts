import { z } from "zod"

const emailSchema = z.email("Enter a valid email address")

export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
})

export const signupFormSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().max(120, "Name must be 120 characters or fewer"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export type LoginFormValues = z.infer<typeof loginFormSchema>
export type SignupFormValues = z.infer<typeof signupFormSchema>
