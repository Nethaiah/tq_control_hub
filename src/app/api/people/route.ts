import { personFormSchema } from "@/domain/schemas"
import { requireAuthContext } from "@/lib/api/auth"
import { requireOwner } from "@/lib/api/permissions"
import { apiError, created } from "@/lib/api/responses"
import { parseBody } from "@/lib/api/validation"
import { createPerson } from "@/lib/db/mutations/people"

export async function POST(request: Request) {
  try {
    const context = await requireAuthContext()
    requireOwner(context)

    const body = parseBody(personFormSchema, await request.json().catch(() => ({})))
    const person = await createPerson(context, body)

    return created({ person })
  } catch (error) {
    return apiError(error)
  }
}
