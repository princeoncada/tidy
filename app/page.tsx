import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function Home() {
  return (
    <MaxWidthWrapper singleItemPage={true}>
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="pb-2 text-center">
          <CardTitle>Tidy</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-sm leading-6 text-muted-foreground">
          <p>
            Tidy organizes your tasks with multiple lists, drag-and-drop reordering, and optimistic updates.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Link
            href="/register"
            className={buttonVariants({
              class: "w-full",
              size: "lg"
            })}
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className={buttonVariants({
              class: "w-full",
              variant: "outline",
              size: "lg"
            })}
          >
            Sign In
          </Link>
        </CardFooter>
      </Card>
    </MaxWidthWrapper>
  );
}
