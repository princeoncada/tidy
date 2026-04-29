import { RouterOutputs } from "@/lib/trpc";

export type Lists = RouterOutputs['list']['getListsWithItems']
export type List = Lists[number]
export type ListItems = List['listItems']
export type ListItem = ListItems[number]
export type OptimisticList = List & {
  isOptimistic?: boolean;
};
export type OptimisticListItem = ListItem & {
  isOptimistic?: boolean;
};