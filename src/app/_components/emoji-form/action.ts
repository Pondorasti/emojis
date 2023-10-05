"use server"

import { SITE_URL } from "@/lib/constants"
import { nanoid } from "@/lib/utils"
import { prisma } from "@/server/db"
import { replicate } from "@/server/replicate"
import { redirect } from "next/navigation"

interface FormState {
  message: string
}

export async function createEmoji(prevFormState: FormState | undefined, formData: FormData): Promise<FormState | void> {
  const rateLimitRes = await fetch(`${SITE_URL}/api/rate-limit`, {
    headers: { Authorization: `Bearer ${process.env.API_SECRET}` },
  })
  if (!rateLimitRes.ok) return { message: "Too many requests, please try again later." }

  const prompt = (formData.get("prompt") as string | null)?.trim().replaceAll(":", "")
  if (!prompt) return // no need to display an error message for blank prompts

  const id = nanoid()
  const safetyRating = await replicate.classifyPrompt({ prompt })
  const data = { id, prompt, safetyRating }

  if (safetyRating >= 9) {
    await prisma.emoji.create({ data: { ...data, isFlagged: true } })
    return { message: "Nice try! Your prompt is inappropriate, let's keep it PG." }
  }

  await Promise.all([prisma.emoji.create({ data }), replicate.createEmoji(data)])

  redirect(`/p/${id}`)
}
