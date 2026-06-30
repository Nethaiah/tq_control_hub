"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2Icon, PlusIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { DatePicker } from "@/components/common/date-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { personFormSchema } from "@/domain/schemas"
import type { Person, PersonFormValues } from "@/domain/types"
import { readApiResponse } from "@/features/metrics/api-client"

type PersonDepartmentOption = {
  active?: boolean
  id: string
  name: string
}

export type AddPersonInitialValues = Partial<PersonFormValues>

type AddPersonDialogProps = {
  departments: PersonDepartmentOption[]
  initialValues?: AddPersonInitialValues
  onOpenChange: (open: boolean) => void
  open: boolean
}

async function createPersonApi(input: PersonFormValues) {
  const response = await fetch("/api/people", {
    body: JSON.stringify(input),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })

  return readApiResponse<{ person: Person }>(response, "Unable to add person")
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function defaultValues(departments: PersonDepartmentOption[], initialValues?: AddPersonInitialValues): PersonFormValues {
  const activeDepartments = departments.filter((department) => department.active !== false)

  return {
    cadence: initialValues?.cadence ?? "monthly",
    costUsd: initialValues?.costUsd ?? 0,
    departmentId: initialValues?.departmentId ?? activeDepartments[0]?.id ?? departments[0]?.id ?? "",
    name: initialValues?.name ?? "",
    role: initialValues?.role ?? "",
    startDate: initialValues?.startDate ?? today(),
    status: initialValues?.status ?? "active",
    type: initialValues?.type ?? "employee",
  }
}

export function AddPersonDialog({ departments, initialValues, onOpenChange, open }: AddPersonDialogProps) {
  const queryClient = useQueryClient()
  const activeDepartments = React.useMemo(
    () => departments.filter((department) => department.active !== false),
    [departments]
  )
  const form = useForm<PersonFormValues>({
    defaultValues: defaultValues(departments, initialValues),
    resolver: zodResolver(personFormSchema as never) as never,
  })
  const createPersonMutation = useMutation({
    mutationFn: createPersonApi,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to add person")
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["metrics"] })
      toast.success("Person added")
      form.reset(defaultValues(departments, initialValues))
      onOpenChange(false)
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset(defaultValues(departments, initialValues))
    }
  }, [departments, form, initialValues, open])

  async function onSubmit(values: PersonFormValues) {
    await createPersonMutation.mutateAsync(values)
  }

  const type = form.watch("type")
  const cadence = form.watch("cadence")
  const status = form.watch("status")
  const startDate = form.watch("startDate")
  const departmentId = form.watch("departmentId")
  const selectedDepartment = departments.find((department) => department.id === departmentId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add person</DialogTitle>
          <DialogDescription>
            Add an employee or contractor to the people cost roster. This does not create app login access.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <div className="grid gap-4 md:grid-cols-2">
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="person-name">Name</FieldLabel>
                <Input id="person-name" aria-invalid={!!form.formState.errors.name} {...form.register("name")} />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.role}>
                <FieldLabel htmlFor="person-role">Role</FieldLabel>
                <Input id="person-role" aria-invalid={!!form.formState.errors.role} {...form.register("role")} />
                <FieldError errors={[form.formState.errors.role]} />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field data-invalid={!!form.formState.errors.departmentId}>
                <FieldLabel>Department</FieldLabel>
                <Select
                  value={departmentId}
                  onValueChange={(value) => form.setValue("departmentId", value ?? "", { shouldDirty: true, shouldValidate: true })}
                >
                  <SelectTrigger className="w-full" aria-label="Department" aria-invalid={!!form.formState.errors.departmentId}>
                    <SelectValue>{selectedDepartment?.name ?? "Choose department"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {activeDepartments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError errors={[form.formState.errors.departmentId]} />
              </Field>
              <Field>
                <FieldLabel>Type</FieldLabel>
                <Select
                  value={type}
                  onValueChange={(value) => form.setValue("type", (value ?? "employee") as PersonFormValues["type"], { shouldDirty: true, shouldValidate: true })}
                >
                  <SelectTrigger className="w-full" aria-label="Type">
                    <SelectValue>{titleCase(type)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field data-invalid={!!form.formState.errors.costUsd}>
                <FieldLabel htmlFor="person-cost">Cost</FieldLabel>
                <Input
                  id="person-cost"
                  aria-invalid={!!form.formState.errors.costUsd}
                  min="0"
                  step="0.01"
                  type="number"
                  {...form.register("costUsd")}
                />
                <FieldError errors={[form.formState.errors.costUsd]} />
              </Field>
              <Field>
                <FieldLabel>Cadence</FieldLabel>
                <Select
                  value={cadence}
                  onValueChange={(value) => form.setValue("cadence", (value ?? "monthly") as PersonFormValues["cadence"], { shouldDirty: true, shouldValidate: true })}
                >
                  <SelectTrigger className="w-full" aria-label="Cadence">
                    <SelectValue>{titleCase(cadence)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select
                  value={status}
                  onValueChange={(value) => form.setValue("status", (value ?? "active") as PersonFormValues["status"], { shouldDirty: true, shouldValidate: true })}
                >
                  <SelectTrigger className="w-full" aria-label="Status">
                    <SelectValue>{titleCase(status)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="offboarded">Offboarded</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field data-invalid={!!form.formState.errors.startDate}>
              <FieldLabel htmlFor="person-start-date">Start date</FieldLabel>
              <DatePicker
                id="person-start-date"
                aria-invalid={!!form.formState.errors.startDate}
                placeholder="Choose start date"
                value={startDate}
                onChange={(value) => form.setValue("startDate", value, { shouldDirty: true, shouldValidate: true })}
              />
              <FieldError errors={[form.formState.errors.startDate]} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPersonMutation.isPending || activeDepartments.length === 0}>
              {createPersonMutation.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
              Add person
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
