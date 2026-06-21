export function listOrderMatches<T extends { id: string }>(
  left: readonly T[],
  right: readonly T[],
): boolean {
  return (
    left.length === right.length &&
    left.every((entry, index) => entry.id === right[index]?.id)
  );
}

export function itemPlacementMatches<
  Item extends { id: string; listId: string },
  ListLike extends { id: string; listItems: readonly Item[] },
>(left: readonly ListLike[], right: readonly ListLike[]): boolean {
  return (
    left.length === right.length &&
    left.every((list, listIndex) => {
      const other = right[listIndex];
      return (
        list.id === other?.id &&
        list.listItems.length === other?.listItems.length &&
        list.listItems.every((item, itemIndex) => {
          const otherItem = other?.listItems[itemIndex];
          return item.id === otherItem?.id && item.listId === otherItem?.listId;
        })
      );
    })
  );
}
