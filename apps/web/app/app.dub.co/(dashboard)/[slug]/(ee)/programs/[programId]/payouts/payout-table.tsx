"use client";

import usePayoutsCount from "@/lib/swr/use-payouts-count";
import useProgram from "@/lib/swr/use-program";
import useWorkspace from "@/lib/swr/use-workspace";
import { PayoutResponse } from "@/lib/types";
import { AmountRowItem } from "@/ui/partners/amount-row-item";
import { PartnerRowItem } from "@/ui/partners/partner-row-item";
import { PayoutDetailsSheet } from "@/ui/partners/payout-details-sheet";
import { PayoutStatusBadges } from "@/ui/partners/payout-status-badges";
import { AnimatedEmptyState } from "@/ui/shared/animated-empty-state";
import {
  AnimatedSizeContainer,
  Filter,
  StatusBadge,
  Table,
  Tooltip,
  usePagination,
  useRouterStuff,
  useTable,
} from "@dub/ui";
import { MoneyBill2 } from "@dub/ui/icons";
import { formatDate, formatDateTime, OG_AVATAR_URL } from "@dub/utils";
import { formatPeriod } from "@dub/utils/src/functions/datetime";
import { fetcher } from "@dub/utils/src/functions/fetcher";
import { memo, useEffect, useState } from "react";
import useSWR from "swr";
import { usePayoutFilters } from "./use-payout-filters";

export function PayoutTable() {
  const filters = usePayoutFilters();
  return <PayoutTableInner {...filters} />;
}

const PayoutTableInner = memo(
  ({
    filters,
    activeFilters,
    onSelect,
    onRemove,
    onRemoveAll,
    isFiltered,
    setSearch,
    setSelectedFilter,
  }: ReturnType<typeof usePayoutFilters>) => {
    const { program } = useProgram();
    const { id: workspaceId } = useWorkspace();
    const { queryParams, searchParams, getQueryString } = useRouterStuff();

    const sortBy = searchParams.get("sortBy") || "periodEnd";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const { payoutsCount, error: countError } = usePayoutsCount<number>();

    const {
      data: payouts,
      error,
      isLoading,
    } = useSWR<PayoutResponse[]>(
      program?.id
        ? `/api/programs/${program.id}/payouts${getQueryString(
            { workspaceId },
            {
              exclude: ["payoutId"],
            },
          )}`
        : undefined,
      fetcher,
      {
        keepPreviousData: true,
      },
    );

    const [detailsSheetState, setDetailsSheetState] = useState<
      | { open: false; payout: PayoutResponse | null }
      | { open: true; payout: PayoutResponse }
    >({ open: false, payout: null });

    useEffect(() => {
      const payoutId = searchParams.get("payoutId");
      if (payoutId) {
        const payout = payouts?.find((p) => p.id === payoutId);
        if (payout) {
          setDetailsSheetState({ open: true, payout });
        }
      } else {
        setDetailsSheetState({ open: false, payout: null });
      }
    }, [searchParams, payouts]);

    const { pagination, setPagination } = usePagination();

    const table = useTable({
      data: payouts || [],
      loading: isLoading,
      error: error || countError ? "Failed to load payouts" : undefined,
      columns: [
        {
          id: "periodEnd",
          header: "Period",
          accessorFn: (d) => formatPeriod(d),
        },
        {
          header: "Partner",
          cell: ({ row }) => {
            return <PartnerRowItem partner={row.original.partner} />;
          },
        },
        {
          header: "Status",
          cell: ({ row }) => {
            const badge = PayoutStatusBadges[row.original.status];

            return badge ? (
              <StatusBadge icon={badge.icon} variant={badge.variant}>
                {badge.label}
              </StatusBadge>
            ) : (
              "-"
            );
          },
        },
        {
          header: "Paid",
          cell: ({ row }) =>
            row.original.paidAt ? (
              <Tooltip
                content={
                  <div className="flex flex-col gap-1 p-2.5">
                    {row.original.user && (
                      <div className="flex flex-col gap-2">
                        <img
                          src={
                            row.original.user.image ||
                            `${OG_AVATAR_URL}${row.original.user.name}`
                          }
                          alt={row.original.user.name ?? row.original.user.id}
                          className="size-6 shrink-0 rounded-full"
                        />
                        <p className="text-sm font-medium">
                          {row.original.user.name}
                        </p>
                      </div>
                    )}
                    <div className="text-xs text-neutral-500">
                      Paid at{" "}
                      <span className="font-medium text-neutral-700">
                        {formatDateTime(row.original.paidAt, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                }
              >
                <div className="flex items-center gap-2">
                  {row.original.user && (
                    <img
                      src={
                        row.original.user.image ||
                        `${OG_AVATAR_URL}${row.original.user.name}`
                      }
                      alt={row.original.user.name ?? row.original.user.id}
                      className="size-5 shrink-0 rounded-full"
                    />
                  )}
                  {formatDate(row.original.paidAt, {
                    month: "short",
                    year: undefined,
                  })}
                </div>
              </Tooltip>
            ) : (
              "-"
            ),
        },
        {
          id: "amount",
          header: "Amount",
          cell: ({ row }) => (
            <AmountRowItem
              amount={row.original.amount}
              status={row.original.status}
              payoutsEnabled={Boolean(row.original.partner.payoutsEnabledAt)}
              minPayoutAmount={program?.minPayoutAmount!}
            />
          ),
        },
      ],
      pagination,
      onPaginationChange: setPagination,
      sortableColumns: ["periodEnd", "amount", "paidAt"],
      sortBy,
      sortOrder,
      onSortChange: ({ sortBy, sortOrder }) =>
        queryParams({
          set: {
            ...(sortBy && { sortBy }),
            ...(sortOrder && { sortOrder }),
          },
          del: "page",
          scroll: false,
        }),
      onRowClick: (row) => {
        queryParams({
          set: {
            payoutId: row.original.id,
          },
          scroll: false,
        });
      },
      columnPinning: { right: ["menu"] },
      thClassName: "border-l-0",
      tdClassName: "border-l-0",
      resourceName: (p) => `payout${p ? "s" : ""}`,
      rowCount: payoutsCount || 0,
    });

    return (
      <>
        {detailsSheetState.payout && (
          <PayoutDetailsSheet
            isOpen={detailsSheetState.open}
            setIsOpen={(open) =>
              setDetailsSheetState((s) => ({ ...s, open }) as any)
            }
            payout={detailsSheetState.payout}
          />
        )}
        <div className="flex flex-col gap-3">
          <div>
            <Filter.Select
              className="w-full md:w-fit"
              filters={filters}
              activeFilters={activeFilters}
              onSelect={onSelect}
              onRemove={onRemove}
              onSearchChange={setSearch}
              onSelectedFilterChange={setSelectedFilter}
            />
            <AnimatedSizeContainer height>
              <div>
                {activeFilters.length > 0 && (
                  <div className="pt-3">
                    <Filter.List
                      filters={filters}
                      activeFilters={activeFilters}
                      onRemove={onRemove}
                      onRemoveAll={onRemoveAll}
                    />
                  </div>
                )}
              </div>
            </AnimatedSizeContainer>
          </div>
          {payouts?.length !== 0 ? (
            <Table {...table} />
          ) : (
            <AnimatedEmptyState
              title="No payouts found"
              description={
                isFiltered
                  ? "No payouts found for the selected filters."
                  : "No payouts have been initiated for this program yet."
              }
              cardContent={() => (
                <>
                  <MoneyBill2 className="size-4 text-neutral-700" />
                  <div className="h-2.5 w-24 min-w-0 rounded-sm bg-neutral-200" />
                </>
              )}
            />
          )}
        </div>
      </>
    );
  },
);
