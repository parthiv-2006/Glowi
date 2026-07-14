/**
 * The sign-up screen is the front door. What matters is that it refuses a
 * password the backend would reject anyway (auth-signup enforces 8–200), that a
 * server refusal reaches the user's eyes instead of a dead button, and that a
 * failed attempt leaves the form usable rather than stuck in a loading state.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';

import SignUp from '@/app/(auth)/sign-up';
import { renderWithProviders } from '@/test/render';
import { resetSupabaseMock } from '@/test/supabaseMock';
import { useAuth } from '@/stores/auth';

jest.mock('@/lib/supabase', () => jest.requireActual('@/test/supabaseMock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));

const signUpEmail = jest.fn<(e: string, p: string, n?: string) => Promise<void>>();

beforeEach(() => {
  resetSupabaseMock();
  signUpEmail.mockReset().mockResolvedValue(undefined);
  useAuth.setState({ signUpEmail });
});

afterEach(() => {
  jest.clearAllMocks();
});

async function fill(email: string, password: string, name?: string) {
  await act(async () => {
    if (name !== undefined) fireEvent.changeText(screen.getByPlaceholderText('Optional'), name);
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), email);
    fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), password);
  });
}

async function submit() {
  await act(async () => {
    fireEvent.press(screen.getByText('Create account'));
  });
}

describe('sign-up', () => {
  it('rejects a short password without calling the server', async () => {
    renderWithProviders(<SignUp />);

    await fill('someone@example.com', 'short');
    await submit();

    expect(screen.getByText('Password must be at least 8 characters')).toBeTruthy();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('submits a valid form, passing the optional name through', async () => {
    renderWithProviders(<SignUp />);

    await fill('someone@example.com', 'longenough', 'Ada');
    await submit();

    expect(signUpEmail).toHaveBeenCalledWith('someone@example.com', 'longenough', 'Ada');
  });

  it('omits an empty name rather than sending a blank one', async () => {
    renderWithProviders(<SignUp />);

    await fill('someone@example.com', 'longenough');
    await submit();

    expect(signUpEmail).toHaveBeenCalledWith('someone@example.com', 'longenough', undefined);
  });

  it('shows the server error and lets the user try again', async () => {
    // The "email already registered" path — a dead button here is a lost signup.
    signUpEmail.mockRejectedValueOnce(new Error('That email is already in use'));

    renderWithProviders(<SignUp />);

    await fill('taken@example.com', 'longenough');
    await submit();

    expect(screen.getByText('That email is already in use')).toBeTruthy();

    // Not stuck: a second attempt still reaches the store.
    signUpEmail.mockResolvedValueOnce(undefined);
    await submit();
    expect(signUpEmail).toHaveBeenCalledTimes(2);
  });
});
