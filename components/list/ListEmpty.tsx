import React from 'react';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty';
import { FolderOpen } from 'lucide-react';
import ListAdder from './ListAdder';

const ListEmpty = () => {
  return (
    <Empty className='mt-12'>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderOpen className='text-zinc-400' />
        </EmptyMedia>
        <EmptyTitle>No Lists Yet</EmptyTitle>
        <EmptyDescription>
          You haven&apos;t created any lists yet. Get started by creating
          your to-do list.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <ListAdder />
      </EmptyContent>
    </Empty>
  );
};

export default ListEmpty;
