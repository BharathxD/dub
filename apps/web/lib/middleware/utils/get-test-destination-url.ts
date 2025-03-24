import { ABTestVariantsSchema, MAX_TEST_COUNT } from "@/lib/zod/schemas/links";
import { cookies } from "next/headers";
import { z } from "zod";

/**
 * Determines the destination URL for a link with A/B testVariants using weighted random selection
 */
export const getTestDestinationURL = ({
  testVariants,
  testCompletedAt,
}: {
  testVariants?: z.infer<typeof ABTestVariantsSchema>;
  testCompletedAt?: Date;
}) => {
  try {
    if (
      !testVariants ||
      !testCompletedAt ||
      !(new Date(testCompletedAt) > new Date())
    )
      return null;

    if (testVariants.length < 2 || testVariants.length > MAX_TEST_COUNT)
      throw new Error("Invalid test count: " + testVariants.length);

    const cookieStore = cookies();
    const cookieUrl = cookieStore.get("dub_test_url")?.value;
    if (cookieUrl && testVariants.map((t) => t.url).includes(cookieUrl))
      return cookieUrl;

    let i = 0;
    const weights = [testVariants[0].percentage];

    // Calculate cumulative weights
    for (i = 1; i < testVariants.length; ++i)
      weights[i] = testVariants[i].percentage + weights[i - 1];

    // Generate a random number between 0 and the total cumulative weight
    const random = Math.random() * weights[weights.length - 1];

    // Loop through cumulative weights and stop when we've found the first one greater than `random`
    for (i = 0; i < weights.length; ++i) if (weights[i] > random) break;

    // Return the corresponding test URL
    return testVariants[i].url;
  } catch (e) {
    console.error("Error getting test destination URL", e);
  }

  return null;
};
