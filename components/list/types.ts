import { RouterOutputs } from "@/lib/trpc";

export type CurrentView = RouterOutputs['view']['getCurrentViewListsWithItems']
export type AllListsView = CurrentView
type BaseList = AllListsView['lists'][number]
export type List = BaseList & {
  accessRole?: "OWNER" | "EDITOR" | "VIEWER";
}
export type Lists = List[]
export type ListItems = List['listItems']
export type ListItem = ListItems[number]
export type OptimisticList = List & {
  isOptimistic?: boolean;
};
export type OptimisticListItem = ListItem & {
  isOptimistic?: boolean;
};
