import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import UserDetails from "@/components/UserDetails";

export default function Page() {
  return (
    <MaxWidthWrapper singleItemPage={true}>
        <UserDetails />
    </MaxWidthWrapper>
  );
}