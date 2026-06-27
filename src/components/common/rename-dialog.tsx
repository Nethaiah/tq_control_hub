"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export type RenameDialogState = {
  open: boolean
  initialValue: string
} | null

export function RenameDialog({
  state,
  onOpenChange,
  title,
  description,
  label = "Name",
  confirmLabel = "Save",
  onConfirm,
}: {
  state: RenameDialogState
  onOpenChange: (state: RenameDialogState) => void
  title: string
  description?: string
  label?: string
  confirmLabel?: string
  onConfirm: (value: string) => void
}) {
  const [value, setValue] = React.useState("")

  React.useEffect(() => {
    if (state?.open) {
      setValue(state.initialValue)
    }
  }, [state])

  function handleOpenChange(open: boolean) {
    if (!open) {
      onOpenChange(null)
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
    onOpenChange(null)
  }

  return (
    <Dialog open={state?.open ?? false} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Field>
            <FieldLabel>{label}</FieldLabel>
            <Input
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
