import {
  LinkTestsSchema,
  MAX_TEST_COUNT,
  MIN_TEST_PERCENTAGE,
} from "@/lib/zod/schemas/links";
import { useAvailableDomains } from "@/ui/links/use-available-domains";
import { useEndABTestingModal } from "@/ui/modals/link-builder/ab-testing/end-ab-testing-modal";
import { BusinessBadgeTooltip } from "@/ui/shared/business-badge-tooltip";
import { X } from "@/ui/shared/icons";
import {
  AnimatedSizeContainer,
  Button,
  CircleCheck,
  Flask,
  InfoTooltip,
  Modal,
  SimpleTooltipContent,
  Tooltip,
  TriangleWarning,
  useKeyboardShortcut,
} from "@dub/ui";
import {
  cn,
  formatDateTime,
  getDateTimeLocal,
  isValidUrl,
  parseDateTime,
} from "@dub/utils";
import { differenceInDays } from "date-fns";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import { useForm, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { LinkFormData } from "..";
import { TrafficSplitSlider } from "./traffic-split-slider";

const parseTests = (tests: LinkFormData["tests"]) =>
  Array.isArray(tests) ? LinkTestsSchema.parse(tests) : null;

const inTwoWeeks = new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000);

function ABTestingModal({
  showABTestingModal,
  setShowABTestingModal,
}: {
  showABTestingModal: boolean;
  setShowABTestingModal: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <Modal
      showModal={showABTestingModal}
      setShowModal={setShowABTestingModal}
      className="sm:max-w-md"
    >
      <ABTestingModalInner setShowABTestingModal={setShowABTestingModal} />
    </Modal>
  );
}

function ABTestingModalInner({
  setShowABTestingModal,
}: {
  setShowABTestingModal: Dispatch<SetStateAction<boolean>>;
}) {
  const { watch: watchParent } = useFormContext<LinkFormData>();

  const [tests, testsCompleteAt] = watchParent(["tests", "testsCompleteAt"]);

  return tests && testsCompleteAt && new Date(testsCompleteAt) < new Date() ? (
    <ABTestingComplete setShowABTestingModal={setShowABTestingModal} />
  ) : (
    <ABTestingEdit setShowABTestingModal={setShowABTestingModal} />
  );
}

function ABTestingEdit({
  setShowABTestingModal,
}: {
  setShowABTestingModal: Dispatch<SetStateAction<boolean>>;
}) {
  const id = useId();

  const {
    watch: watchParent,
    getValues: getValuesParent,
    setValue: setValueParent,
  } = useFormContext<LinkFormData>();

  const domain = watchParent("domain");
  const { domains } = useAvailableDomains({
    currentDomain: domain,
  });

  const { EndABTestingModal, setShowEndABTestingModal } = useEndABTestingModal({
    onEndTest: () => setShowABTestingModal(false),
  });

  const {
    watch,
    register,
    setValue,
    getValues,
    reset,
    formState: { isDirty, isValid },
    handleSubmit,
  } = useForm<
    { tests: z.infer<typeof LinkTestsSchema> } & Pick<
      LinkFormData,
      "testsCompleteAt"
    >
  >({
    mode: "onChange",
    values: {
      tests: parseTests(getValuesParent("tests")) ?? [
        { url: getValuesParent("url") || "", percentage: 100 },
      ],
      testsCompleteAt:
        (getValuesParent("testsCompleteAt") as Date | null) ?? inTwoWeeks,
    },
  });

  const tests = watch("tests") || [];
  const testsCompleteAt = watch("testsCompleteAt");
  const [idParent, testsParent, testsStartedAtParent] = watchParent([
    "id",
    "tests",
    "testsStartedAt",
  ]);

  const addTestUrl = () => {
    if (!tests.length || tests.length >= MAX_TEST_COUNT) return;

    const allEqual = tests.every(
      ({ percentage }) => Math.abs(percentage - tests[0].percentage) <= 1,
    );

    if (allEqual) {
      // All percentages are equal so let's keep it that way
      const each = Math.floor(100 / (tests.length + 1));
      setValue(
        "tests",
        [
          ...tests.map((t) => ({ ...t, percentage: each })),
          { url: "", percentage: 100 - each * tests.length },
        ],
        { shouldDirty: true },
      );
    } else {
      // Not all percentages are equal so let's split the latest one we can
      const toSplitIndex = tests.findLastIndex(
        ({ percentage }) => percentage >= MIN_TEST_PERCENTAGE * 2,
      );
      const toSplit = tests[toSplitIndex];
      const toSplitPercentage = Math.floor(toSplit.percentage / 2);
      const remainingPercentage = toSplit.percentage - toSplitPercentage;

      setValue(
        "tests",
        [
          ...tests.map((test, idx) => ({
            ...test,
            percentage:
              idx === toSplitIndex ? toSplitPercentage : test.percentage,
          })),
          { url: "", percentage: remainingPercentage },
        ],
        {
          shouldDirty: true,
        },
      );
    }
  };

  const removeTestUrl = (index: number) => {
    if (tests.length < 2) return;

    const allEqual = tests.every(
      ({ percentage }) => Math.abs(percentage - tests[0].percentage) <= 1,
    );

    if (allEqual) {
      // All percentages are equal so let's keep it that way
      const each = Math.floor(100 / (tests.length - 1));
      const remainder = 100 - each * (tests.length - 2);

      setValue(
        "tests",
        tests
          ?.filter((_, i) => i !== index)
          .map((test, idx, arr) => ({
            ...test,
            percentage: idx === arr.length - 1 ? remainder : each,
          })) ?? null,
        {
          shouldDirty: true,
        },
      );
    } else {
      // Not all percentages are equal so let's give the last one the remainder
      const remainder = tests[index].percentage;

      setValue(
        "tests",
        tests
          ?.filter((_, i) => i !== index)
          .map((test, idx, arr) => ({
            ...test,
            percentage:
              idx === arr.length - 1
                ? test.percentage + remainder
                : test.percentage,
          })) ?? null,
        {
          shouldDirty: true,
        },
      );
    }
  };

  return (
    <>
      <EndABTestingModal />
      <form
        className="px-5 py-4"
        onSubmit={(e) => {
          e.stopPropagation();
          handleSubmit((data) => {
            const currentTests = data.tests;

            if (!currentTests || currentTests.length <= 1) {
              setValueParent("tests", null, { shouldDirty: true });
              setValueParent("testsCompleteAt", null, {
                shouldDirty: true,
              });

              return;
            }

            // Validate total percentage equals 100
            const totalPercentage = currentTests.reduce(
              (sum, test) => sum + test.percentage,
              0,
            );

            if (totalPercentage !== 100) {
              toast.error("Total percentage must equal 100%");
              return;
            }

            // Validate all URLs are filled
            if (currentTests.some((test) => !test.url)) {
              toast.error("All test URLs must be filled");
              return;
            }

            setValueParent("url", currentTests[0].url, { shouldDirty: true });
            setValueParent("trackConversion", true);
            setValueParent("tests", currentTests, { shouldDirty: true });
            setValueParent("testsCompleteAt", data.testsCompleteAt, {
              shouldDirty: true,
            });
            if (!testsStartedAtParent)
              setValueParent("testsStartedAt", new Date(), {
                shouldDirty: true,
              });

            setShowABTestingModal(false);
          })(e);
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium">A/B Testing</h3>
            <BusinessBadgeTooltip
              content={
                <SimpleTooltipContent
                  title="Test different URLs against each other to optimize your conversion rates."
                  cta="Learn more."
                  href="https://dub.co/help/article/ab-testing"
                />
              }
            />
          </div>
          <div className="max-md:hidden">
            <Tooltip
              content={
                <div className="px-2 py-1 text-xs text-neutral-700">
                  Press{" "}
                  <strong className="font-medium text-neutral-950">A</strong> to
                  open this quickly
                </div>
              }
              side="right"
            >
              <kbd className="flex size-6 cursor-default items-center justify-center rounded-md border border-neutral-200 font-sans text-xs text-neutral-950">
                A
              </kbd>
            </Tooltip>
          </div>
        </div>

        {/* Testing URLs */}
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-neutral-700">
              Testing URLs
            </label>
            <InfoTooltip
              content={
                <SimpleTooltipContent
                  title="Add up to 3 additional destination URLs to test for this short link."
                  cta="Learn more"
                  href="https://dub.co/help/article/ab-testing" // TODO: Add article
                />
              }
            />
          </div>
          <div className="mt-2">
            <AnimatedSizeContainer
              height
              transition={{ ease: "easeInOut", duration: 0.2 }}
              className="-m-1"
            >
              <div className="flex flex-col gap-2 p-1">
                {tests.map((_, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <label className="relative block flex grow items-center overflow-hidden rounded-md border border-neutral-300 focus-within:border-neutral-500 focus-within:ring-1 focus-within:ring-neutral-500">
                      <span className="flex h-9 w-8 items-center justify-center border-r border-neutral-300 text-center text-sm font-medium text-neutral-800">
                        {index + 1}
                      </span>
                      <input
                        type="url"
                        placeholder={
                          domains?.find(({ slug }) => slug === domain)
                            ?.placeholder ||
                          "https://dub.co/help/article/what-is-dub"
                        }
                        className="block h-9 grow border-none px-2 text-neutral-900 placeholder-neutral-400 focus:ring-0 sm:text-sm"
                        {...register(`tests.${index}.url`, {
                          validate: (value, { tests }) => {
                            if (!value) return "URL is required";

                            if (!isValidUrl(value)) return "Invalid URL";

                            return (
                              tests.length > 1 && tests.length <= MAX_TEST_COUNT
                            );
                          },
                        })}
                      />
                      {index > 0 && (
                        <Button
                          onClick={() => removeTestUrl(index)}
                          variant="outline"
                          className="mr-1 size-7 p-0"
                          text={
                            <>
                              <span className="sr-only">Remove</span>
                              <X className="size-4" />
                            </>
                          }
                        />
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </AnimatedSizeContainer>

            <Button
              type="button"
              variant="primary"
              className="mt-2 h-8"
              onClick={addTestUrl}
              disabledTooltip={
                tests.length >= MAX_TEST_COUNT
                  ? `You may only add ${MAX_TEST_COUNT} URLs`
                  : undefined
              }
              text="Add URL"
            />
          </div>
        </div>

        {/* Traffic split */}
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-neutral-700">
              Traffic split
            </label>
            <InfoTooltip
              content={`Adjust the percentage of traffic to each URL. The minimum is ${MIN_TEST_PERCENTAGE}%`}
            />
          </div>
          <div className="mt-4">
            <TrafficSplitSlider
              tests={tests}
              onChange={(percentages) => {
                percentages.forEach((percentage, index) => {
                  setValue(`tests.${index}.percentage`, percentage, {
                    shouldDirty: true,
                  });
                });
              }}
            />
          </div>
        </div>

        {/* Completion Date */}
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <label
              htmlFor={`${id}-testsCompleteAt`}
              className="block text-sm font-medium text-neutral-700"
            >
              Completion Date
            </label>
            <InfoTooltip
              content={
                <SimpleTooltipContent
                  title="Set when the A/B test should complete. After this date, all traffic will go to the best performing URL."
                  cta="Learn more."
                  href="https://dub.co/help/article/ab-testing"
                />
              }
            />
          </div>
          <div className="mt-2 flex w-full items-center justify-between rounded-md border border-neutral-300 bg-white shadow-sm transition-all focus-within:border-neutral-800 focus-within:outline-none focus-within:ring-1 focus-within:ring-neutral-500">
            <input
              id={`${id}-testsCompleteAt`}
              type="text"
              placeholder='E.g. "in 2 weeks" or "next month"'
              defaultValue={
                getValues("testsCompleteAt")
                  ? formatDateTime(getValues("testsCompleteAt") as Date)
                  : ""
              }
              onBlur={(e) => {
                if (e.target.value.length > 0) {
                  const parsedDateTime = parseDateTime(e.target.value);
                  if (parsedDateTime) {
                    setValue("testsCompleteAt", parsedDateTime, {
                      shouldDirty: true,
                    });
                    e.target.value = formatDateTime(parsedDateTime);
                  }
                }
              }}
              className="flex-1 border-none bg-transparent text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-0 sm:text-sm"
            />
            <input
              type="datetime-local"
              value={
                getValues("testsCompleteAt")
                  ? getDateTimeLocal(getValues("testsCompleteAt") as Date)
                  : ""
              }
              onChange={(e) => {
                const completeDate = new Date(e.target.value);
                setValue("testsCompleteAt", completeDate, {
                  shouldDirty: true,
                });
              }}
              className="w-[40px] border-none bg-transparent text-neutral-500 focus:outline-none focus:ring-0 sm:text-sm"
            />
          </div>
          <p className="mt-1 text-xs text-neutral-500">6 weeks maximum</p>
        </div>

        {testsParent && (
          <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <TriangleWarning className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-sm font-medium text-amber-900">
              Changing the original A/B test settings will impact your future
              analytics and event tracking.
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div>
            {Boolean(testsParent) && (
              <button
                type="button"
                className="text-xs font-medium text-neutral-700 transition-colors hover:text-neutral-950"
                onClick={() => {
                  if (idParent) {
                    setShowEndABTestingModal(true);
                  } else {
                    (["tests", "testsCompleteAt"] as const).forEach((key) =>
                      setValueParent(key, null, { shouldDirty: true }),
                    );
                    setShowABTestingModal(false);
                  }
                }}
              >
                {idParent ? "End" : "Remove"} A/B test
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              text="Cancel"
              className="h-9 w-fit"
              onClick={() => {
                reset();
                setShowABTestingModal(false);
              }}
            />
            <Button
              type="submit"
              variant="primary"
              text={
                Array.isArray(testsParent) && testsParent.length > 1
                  ? "Save changes"
                  : "Start testing"
              }
              className="h-9 w-fit"
              disabled={
                !isDirty ||
                !isValid ||
                Boolean(
                  testsCompleteAt &&
                    // Restrict competion date from -1 days to 6 weeks
                    (differenceInDays(testsCompleteAt, new Date()) > 6 * 7 ||
                      differenceInDays(testsCompleteAt, new Date()) < -1),
                )
              }
            />
          </div>
        </div>
      </form>
    </>
  );
}

function ABTestingComplete({
  setShowABTestingModal,
}: {
  setShowABTestingModal: Dispatch<SetStateAction<boolean>>;
}) {
  const { watch } = useFormContext<LinkFormData>();

  const [testsRaw, winnerUrl] = watch(["tests", "url"]);
  const tests = useMemo(() => parseTests(testsRaw), [testsRaw]);

  return (
    <div className="px-5 py-4">
      <h3 className="text-lg font-medium">A/B test complete</h3>

      {/* Testing URLs */}
      <div className="mt-6">
        <div className="flex flex-col gap-2">
          {tests?.map((test, index) => (
            <div
              key={index}
              className="relative block flex grow items-center overflow-hidden rounded-md border border-neutral-300 focus-within:border-neutral-500 focus-within:ring-1 focus-within:ring-neutral-500"
            >
              <span className="flex h-9 w-8 shrink-0 items-center justify-center border-r border-neutral-300 text-center text-sm font-medium text-neutral-800">
                {index + 1}
              </span>
              <span className="min-w-0 grow truncate px-2 text-sm text-neutral-800 placeholder-neutral-400">
                {test.url}
              </span>
              {winnerUrl === test.url && (
                <CircleCheck className="ml-2 mr-3 size-4 shrink-0 text-blue-500" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            text="Close"
            className="h-9 w-fit"
            onClick={() => {
              setShowABTestingModal(false);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function getABTestingLabel({
  tests,
  testsCompleteAt,
}: Pick<LinkFormData, "tests" | "testsCompleteAt">) {
  const enabled = Boolean(tests && testsCompleteAt);

  if (testsCompleteAt && new Date() > new Date(testsCompleteAt))
    return "Test Complete";

  return enabled && Array.isArray(tests) ? `${tests?.length} URLs` : "A/B Test";
}

function ABTestingButton({
  setShowABTestingModal,
}: {
  setShowABTestingModal: Dispatch<SetStateAction<boolean>>;
}) {
  const { watch } = useFormContext<LinkFormData>();
  const [tests, testsCompleteAt] = watch(["tests", "testsCompleteAt"]);

  useKeyboardShortcut("a", () => setShowABTestingModal(true), {
    modal: true,
  });

  const enabled = Boolean(tests && testsCompleteAt);
  const complete = enabled && new Date() > new Date(testsCompleteAt!);

  const label = useMemo(
    () => getABTestingLabel({ tests, testsCompleteAt }),
    [tests, testsCompleteAt],
  );

  const Icon = complete ? CircleCheck : Flask;

  return (
    <Button
      variant="secondary"
      text={label}
      icon={<Icon className={cn("size-4", enabled && "text-blue-500")} />}
      className="h-9 w-fit px-2.5 font-medium text-neutral-700"
      onClick={() => setShowABTestingModal(true)}
    />
  );
}

export function useABTestingModal() {
  const [showABTestingModal, setShowABTestingModal] = useState(false);

  const ABTestingModalCallback = useCallback(() => {
    return (
      <>
        <ABTestingModal
          showABTestingModal={showABTestingModal}
          setShowABTestingModal={setShowABTestingModal}
        />
      </>
    );
  }, [showABTestingModal, setShowABTestingModal]);

  const ABTestingButtonCallback = useCallback(() => {
    return <ABTestingButton setShowABTestingModal={setShowABTestingModal} />;
  }, [setShowABTestingModal]);

  return useMemo(
    () => ({
      setShowABTestingModal,
      ABTestingModal: ABTestingModalCallback,
      ABTestingButton: ABTestingButtonCallback,
    }),
    [setShowABTestingModal, ABTestingModalCallback, ABTestingButtonCallback],
  );
}
