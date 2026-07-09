import { describe, expect, it } from '@jest/globals';

import { correlateScanTrends } from '../correlation';
import { concernsTargetedBy } from '../ingredientConcerns';
import type { LifestyleLog, ReactionLog, Scan, ShelfItem } from '../types';
import fixture from './fixtures/correlation-parity.json';

/**
 * Locks in the exact correlation output for a fixed input. The Deno port
 * (supabase/functions/_shared/correlation.ts + ingredientConcerns.ts) is
 * expected to reproduce identical headlines/directions/matches for the same
 * fixture — see supabase/functions/_shared/__fixtures__/correlation-parity.json.
 */
describe('correlation × ingredientConcerns parity fixture', () => {
  for (const testCase of fixture.cases) {
    it(testCase.name, () => {
      const insights = correlateScanTrends(
        testCase.scans as unknown as Scan[],
        testCase.shelfItems as unknown as ShelfItem[],
        testCase.reactions as unknown as ReactionLog[],
        testCase.lifestyleLogs as unknown as LifestyleLog[],
      );

      expect(insights).toHaveLength(testCase.expected.length);

      testCase.expected.forEach((expected, i) => {
        const insight = insights[i];
        expect(insight.headline).toBe(expected.headline);
        expect(insight.direction).toBe(expected.direction);
        expect(insight.concernDeltas[0]?.slug).toBe(expected.topConcernSlug);

        const matched =
          insight.concernDeltas[0] == null
            ? null
            : (insight.event.key_ingredients.find((ing) =>
                concernsTargetedBy([ing]).includes(insight.concernDeltas[0].slug),
              ) ?? null);
        expect(matched).toBe(expected.matchedIngredient);
      });
    });
  }
});
