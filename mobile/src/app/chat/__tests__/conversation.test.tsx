/**
 * Chat send has one rule worth a test above all others: a failed send must not
 * eat the user's words. It used to — the draft was cleared up front and the
 * `finally` invalidate wiped the optimistic bubble, so a message sent with no
 * signal vanished with no error anywhere. These tests pin the fix: the text
 * comes back in the composer, and the failure is said out loud.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import Conversation from '@/app/chat/[sessionId]';
import { getAIProvider } from '@/lib/ai';
import { AIHttpError } from '@/lib/ai/live';
import { resetSupabaseMock, setResponder } from '@/test/supabaseMock';
import { renderWithProviders } from '@/test/render';

jest.mock('@/lib/supabase', () => jest.requireActual('@/test/supabaseMock'));
// The AI seam is the boundary here (ADR-0003): the screen talks to a provider, not
// to the network, so this is the honest place to stand in. The factory closes over
// nothing — the fakes are attached per test below — so the imports above can stay
// where imports belong.
jest.mock('@/lib/ai', () => ({ getAIProvider: jest.fn() }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ sessionId: 'session-1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

const mockChat = jest.fn<() => Promise<{ message: string; productRefs: string[] }>>();
const mockExtractMemories = jest.fn(async () => undefined);

beforeEach(() => {
  resetSupabaseMock();
  mockChat.mockReset();
  jest.mocked(getAIProvider).mockReturnValue({
    chat: mockChat,
    extractMemories: mockExtractMemories,
  } as unknown as ReturnType<typeof getAIProvider>);
  // No stored messages, no scans: the screen opens on its empty state.
  setResponder(() => ({ data: [], error: null }));
});

afterEach(() => {
  jest.clearAllMocks();
});

async function type(text: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText('Message your coach…'), text);
  });
}

async function send() {
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Send message'));
  });
}

describe('chat send', () => {
  it('echoes the message optimistically and clears the composer', async () => {
    let settleChat: (reply: { message: string; productRefs: string[] }) => void = () => {};
    mockChat.mockImplementation(() => new Promise((resolve) => (settleChat = resolve)));

    renderWithProviders(<Conversation />);

    await type('why is my chin breaking out');
    await send();

    // Painted before the coach has answered.
    expect(screen.getByText('why is my chin breaking out')).toBeTruthy();
    expect(screen.getByPlaceholderText('Message your coach…').props.value).toBe('');
    expect(mockChat).toHaveBeenCalledWith({
      sessionId: 'session-1',
      message: 'why is my chin breaking out',
    });

    await act(async () => {
      settleChat({ message: 'Chin acne is usually hormonal.', productRefs: [] });
    });
  });

  it('gives the words back and says what happened when the send fails', async () => {
    mockChat.mockRejectedValue(new Error('Network request failed'));

    renderWithProviders(<Conversation />);

    await type('is retinol safe while pregnant');
    await send();

    await waitFor(() => {
      expect(screen.getByText("Couldn't send that — check your connection.")).toBeTruthy();
    });
    // The message is back in the composer, not lost.
    expect(screen.getByPlaceholderText('Message your coach…').props.value).toBe(
      'is retinol safe while pregnant',
    );
    // And the optimistic bubble is gone — nothing was persisted, so showing it
    // would imply the coach received a message it never did.
    expect(screen.queryByText('is retinol safe while pregnant')).toBeNull();
  });

  it('surfaces a rate-limit message from the server verbatim', async () => {
    // A1's 429 copy is written to be read by a human; the screen must not
    // replace it with a generic connection error.
    mockChat.mockRejectedValue(
      new AIHttpError("You're doing that a lot — try again in a bit.", 429),
    );

    renderWithProviders(<Conversation />);

    await type('hello');
    await send();

    await waitFor(() => {
      expect(screen.getByText("You're doing that a lot — try again in a bit.")).toBeTruthy();
    });
  });

  it('does not send an empty draft', async () => {
    renderWithProviders(<Conversation />);

    await type('   ');
    await send();

    expect(mockChat).not.toHaveBeenCalled();
  });
});
