import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { StepNoteEditor } from '@/components/StepNoteEditor';

describe('StepNoteEditor', () => {
  it('shows an "Add a note" prompt when there is no note yet', () => {
    render(<StepNoteEditor note={null} onSave={jest.fn()} />);
    expect(screen.getByLabelText('Add a note')).toBeTruthy();
    expect(screen.queryByLabelText('Edit note')).toBeNull();
  });

  it('shows the saved note, tap-to-edit, when one exists', () => {
    render(<StepNoteEditor note="Skip this when traveling" onSave={jest.fn()} />);
    expect(screen.getByText('Skip this when traveling')).toBeTruthy();
    expect(screen.getByLabelText('Edit note')).toBeTruthy();
  });

  it('enters edit mode and saves a trimmed note', () => {
    const onSave = jest.fn();
    render(<StepNoteEditor note={null} onSave={onSave} />);

    fireEvent.press(screen.getByLabelText('Add a note'));
    fireEvent.changeText(screen.getByLabelText('Step note'), '  Use gentler cleanser  ');
    fireEvent.press(screen.getByLabelText('Save note'));

    expect(onSave).toHaveBeenCalledWith('Use gentler cleanser');
  });

  it('saves null when the draft is cleared to empty', () => {
    const onSave = jest.fn();
    render(<StepNoteEditor note="Old note" onSave={onSave} />);

    fireEvent.press(screen.getByLabelText('Edit note'));
    fireEvent.changeText(screen.getByLabelText('Step note'), '   ');
    fireEvent.press(screen.getByLabelText('Save note'));

    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('discards the draft on cancel without calling onSave', () => {
    const onSave = jest.fn();
    render(<StepNoteEditor note="Old note" onSave={onSave} />);

    fireEvent.press(screen.getByLabelText('Edit note'));
    fireEvent.changeText(screen.getByLabelText('Step note'), 'Something else entirely');
    fireEvent.press(screen.getByText('Cancel'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Old note')).toBeTruthy();
  });
});
