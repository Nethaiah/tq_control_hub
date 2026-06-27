"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table as TanStackTable,
  type VisibilityState,
} from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    align?: "left" | "center" | "right"
    className?: string
    headerClassName?: string
  }
}

type DataTableProps<TData> = {
  data: TData[]
  columns: ColumnDef<TData>[]
  getRowId?: (row: TData, index: number) => string
  searchPlaceholder?: string
  enableRowSelection?: boolean
  bulkActions?: (table: TanStackTable<TData>) => React.ReactNode
  pageSizeOptions?: number[]
  initialPageSize?: number
  emptyMessage?: string
  wide?: boolean
  className?: string
}

function alignmentClass(align?: "left" | "center" | "right") {
  if (align === "right") {
    return "text-right"
  }

  if (align === "center") {
    return "text-center"
  }

  return "text-left"
}

function sortingIcon(direction: false | "asc" | "desc") {
  if (direction === "asc") {
    return <ArrowUpIcon data-icon="inline-end" />
  }

  if (direction === "desc") {
    return <ArrowDownIcon data-icon="inline-end" />
  }

  return <ArrowUpDownIcon data-icon="inline-end" />
}

function pageNumbers(pageIndex: number, pageCount: number) {
  const pages = new Set([0, pageCount - 1, pageIndex - 1, pageIndex, pageIndex + 1])
  return Array.from(pages)
    .filter((page) => page >= 0 && page < pageCount)
    .sort((a, b) => a - b)
}

function DataTablePagination<TData>({
  table,
  pageSizeOptions,
}: {
  table: TanStackTable<TData>
  pageSizeOptions: number[]
}) {
  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex
  const pages = pageNumbers(pageIndex, pageCount)

  return (
    <div className="flex flex-col gap-3 border-t p-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} rows selected
        </span>
        <span>Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows</span>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-7 w-20" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="ghost"
                size="icon"
                disabled={!table.getCanPreviousPage()}
                aria-label="First page"
                onClick={() => table.firstPage()}
              >
                <ChevronsLeftIcon />
              </Button>
            </PaginationItem>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  table.previousPage()
                }}
                aria-disabled={!table.getCanPreviousPage()}
                className={cn(!table.getCanPreviousPage() && "pointer-events-none opacity-50")}
              />
            </PaginationItem>
            {pages.map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  href="#"
                  isActive={page === pageIndex}
                  onClick={(event) => {
                    event.preventDefault()
                    table.setPageIndex(page)
                  }}
                >
                  {page + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  table.nextPage()
                }}
                aria-disabled={!table.getCanNextPage()}
                className={cn(!table.getCanNextPage() && "pointer-events-none opacity-50")}
              />
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="ghost"
                size="icon"
                disabled={!table.getCanNextPage()}
                aria-label="Last page"
                onClick={() => table.lastPage()}
              >
                <ChevronsRightIcon />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}

export function DataTable<TData>({
  data,
  columns,
  getRowId,
  searchPlaceholder = "Search rows",
  enableRowSelection = false,
  bulkActions,
  pageSizeOptions = [5, 10, 20, 50],
  initialPageSize = 10,
  emptyMessage = "No rows found.",
  wide = false,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  })

  const selectionColumn = React.useMemo<ColumnDef<TData>>(
    () => ({
      id: "select",
      enableSorting: false,
      enableHiding: false,
      meta: {
        align: "center",
        className: "w-10",
        headerClassName: "w-10",
      },
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
          aria-label="Select page rows"
        />
      ),
      cell: ({ row }: { row: Row<TData> }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked === true)}
          aria-label="Select row"
        />
      ),
    }),
    []
  )

  const tableColumns = React.useMemo(
    () => (enableRowSelection ? [selectionColumn, ...columns] : columns),
    [columns, enableRowSelection, selectionColumn]
  )

  const table = useReactTable({
    data,
    columns: tableColumns,
    getRowId,
    state: {
      sorting,
      globalFilter,
      rowSelection,
      columnVisibility,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    enableRowSelection,
    autoResetPageIndex: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className={cn("min-w-0 max-w-full overflow-hidden rounded-lg border bg-card", className)}>
      <div className="flex min-w-0 flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SearchIcon className="text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            className="max-w-sm"
          />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {bulkActions?.(table)}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <SlidersHorizontalIcon data-icon="inline-start" />
              Columns
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                {table
                  .getAllLeafColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(checked) => column.toggleVisibility(checked === true)}
                    >
                      {column.id.replace(/_/g, " ")}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            onClick={() => {
              table.resetSorting()
              table.resetColumnVisibility()
              table.resetRowSelection()
              setGlobalFilter("")
            }}
          >
            Reset table
          </Button>
        </div>
      </div>
      <Table className={wide ? "w-max min-w-full" : "table-fixed"}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    alignmentClass(header.column.columnDef.meta?.align),
                    header.column.columnDef.meta?.headerClassName
                  )}
                  style={{ width: wide ? header.getSize() : undefined }}
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <Button
                      variant="ghost"
                      className={cn(
                        "h-auto p-0 font-medium",
                        header.column.columnDef.meta?.align === "right" && "ml-auto",
                        header.column.columnDef.meta?.align === "center" && "mx-auto"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sortingIcon(header.column.getIsSorted())}
                    </Button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      alignmentClass(cell.column.columnDef.meta?.align),
                      cell.column.columnDef.meta?.className
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={tableColumns.length} className="h-24 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
    </div>
  )
}
