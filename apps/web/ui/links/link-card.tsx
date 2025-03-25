import useFolder from "@/lib/swr/use-folder";
import useWorkspace from "@/lib/swr/use-workspace";
import { CardList, ExpandingArrow, useMediaQuery } from "@dub/ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  createContext,
  Dispatch,
  memo,
  SetStateAction,
  useContext,
  useState,
} from "react";
import { FolderIcon } from "../folders/folder-icon";
import { useLinkBuilder } from "../modals/link-builder";
import { LinkDetailsColumn } from "./link-details-column";
import { LinkTests } from "./link-tests";
import { LinkTitleColumn } from "./link-title-column";
import { ResponseLink } from "./links-container";

export const LinkCardContext = createContext<{
  showTests: boolean;
  setShowTests: Dispatch<SetStateAction<boolean>>;
} | null>(null);

export function useLinkCardContext() {
  const context = useContext(LinkCardContext);
  if (!context)
    throw new Error("useLinkCardContext must be used within a LinkCard");
  return context;
}

export const LinkCard = memo(({ link }: { link: ResponseLink }) => {
  const [showTests, setShowTests] = useState(false);
  return (
    <LinkCardContext.Provider value={{ showTests, setShowTests }}>
      <LinkCardInner link={link} />
    </LinkCardContext.Provider>
  );
});

const LinkCardInner = memo(({ link }: { link: ResponseLink }) => {
  const { variant } = useContext(CardList.Context);
  const { isMobile } = useMediaQuery();

  const { setShowLinkBuilder, LinkBuilder } = useLinkBuilder({
    props: link,
  });
  const searchParams = useSearchParams();
  const { slug, defaultFolderId } = useWorkspace();

  // TODO: only enable this when the link card is in view
  const { folder } = useFolder({ folderId: link.folderId });

  return (
    <>
      <LinkBuilder />
      <CardList.Card
        key={link.id}
        onClick={isMobile ? undefined : () => setShowLinkBuilder(true)}
        outerClassName="overflow-hidden"
        innerClassName="p-0"
        {...(variant === "loose" &&
          link.folderId &&
          ![defaultFolderId, searchParams.get("folderId")].includes(
            link.folderId,
          ) && {
            banner: (
              <Link
                href={`/${slug}?folderId=${folder?.id}`}
                className="group flex items-center justify-between gap-2 rounded-t-xl border-b border-neutral-100 bg-neutral-50 px-5 py-2 text-xs"
              >
                <div className="flex items-center gap-1.5">
                  {folder ? (
                    <FolderIcon
                      folder={folder}
                      shape="square"
                      className="rounded"
                      innerClassName="p-0.5"
                      iconClassName="size-3"
                    />
                  ) : (
                    <div className="size-4 rounded-md bg-neutral-200" />
                  )}
                  {folder ? (
                    <span className="font-medium text-neutral-900">
                      {folder.name}
                    </span>
                  ) : (
                    <div className="h-4 w-20 rounded-md bg-neutral-200" />
                  )}
                  <ExpandingArrow className="invisible -ml-1.5 size-3.5 text-neutral-500 group-hover:visible" />
                </div>
                <p className="text-neutral-500 underline transition-colors group-hover:text-neutral-800">
                  Open folder
                </p>
              </Link>
            ),
          })}
      >
        <div className="flex items-center gap-5 px-4 py-2.5 text-sm sm:gap-8 md:gap-12">
          <div className="min-w-0 grow">
            <LinkTitleColumn link={link} />
          </div>
          <LinkDetailsColumn link={link} />
        </div>
        <LinkTests link={link} />
      </CardList.Card>
    </>
  );
});
