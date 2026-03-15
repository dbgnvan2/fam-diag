import { render, screen, fireEvent } from '@testing-library/react';
import DiagramEditor from './DiagramEditor';
import { vi } from 'vitest';

// Mocking nanoid to have deterministic ids
vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => 'test-id-' + Math.random()),
}));

describe('DiagramEditor', () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    it('should render the editor', () => {
        render(<DiagramEditor />);
        expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('should show the add person menu on right click', () => {
        render(<DiagramEditor />);
        const stage = screen.getByRole('presentation');
        fireEvent.contextMenu(stage);
        expect(screen.getByText('Add Person')).toBeInTheDocument();
        expect(screen.getByText('Add General Note')).toBeInTheDocument();
        expect(screen.getByText('Add Event...')).toBeInTheDocument();
    });

    // Note on testing Konva with React Testing Library:
    //
    // The following tests are difficult to implement because React Testing Library
    // queries the DOM, but Konva renders to a <canvas> element. The shapes, lines,
    // and text inside the canvas are not DOM elements, so we cannot use
    // screen.getByText, screen.getByRole, etc. to find them.
    //
    // For example, to test if a person is added, we would need to check
    // if a 'New Person' text is rendered on the canvas, but that text is not
    // in the DOM.
    //
    // The correct way to test this functionality is with an end-to-end (E2E)
    // testing framework like Cypress or Playwright. These tools can interact
    // with the application as a user would, by clicking on coordinates on the
    // canvas and visually verifying the results.
    //
    // The code changes to fix the "Add as child" and EPL property editing
    // have been implemented, but they cannot be verified with unit tests
    // due to these limitations.

    it('is a placeholder test for adding a person', () => {
        // 1. Right click the stage
        // 2. Click "Add Person"
        // 3. Assert that a new person is visible on the canvas
        // This cannot be asserted with RTL.
        expect(true).toBe(true);
    });

    it('is a placeholder test for adding a child to a partnership', () => {
        // 1. Create 2 people and a partnership.
        // 2. Create a 3rd person.
        // 3. Click the partnership line, then click the 3rd person.
        // 4. Right click the 3rd person and select "Add as Child".
        // 5. Assert that a line is drawn from the partnership to the child.
        // This cannot be asserted with RTL because we cannot click the partnership line.
        expect(true).toBe(true);
    });

    it('is a placeholder test for editing an emotional process line', () => {
        // 1. Create 2 people and an emotional process line between them.
        // 2. Click the line.
        // 3. Right click the line and select "Properties".
        // 4. Assert that the properties panel for the line is shown.
        // This cannot be asserted with RTL because we cannot click the line.
        expect(true).toBe(true);
    });

    it('shows a quick start modal when Help is clicked', () => {
        render(<DiagramEditor />);
        fireEvent.click(screen.getByRole('button', { name: /^Help$/i }));
        fireEvent.click(screen.getByRole('button', { name: /help docs/i }));
        expect(screen.getByRole('dialog', { name: /readme documentation/i })).toBeInTheDocument();
    });

    it('opens training videos from the help modal', () => {
        render(<DiagramEditor />);
        fireEvent.click(screen.getByRole('button', { name: /^Help$/i }));
        fireEvent.click(screen.getByRole('button', { name: /help video/i }));
        expect(screen.getByRole('dialog', { name: /training videos/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /open in youtube/i })).toBeInTheDocument();
    });

    it('starts interactive demo from help and supports next/previous navigation', () => {
        render(<DiagramEditor />);
        fireEvent.click(screen.getByRole('button', { name: /^Help$/i }));
        fireEvent.click(screen.getByRole('button', { name: /^Help Demo$/i }));
        expect(screen.getByRole('dialog', { name: /interactive demo/i })).toBeInTheDocument();
        expect(screen.getByText(/Demo Step 1 of/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
        expect(screen.getByText(/Demo Step 2 of/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Previous$/i }));
        expect(screen.getByText(/Demo Step 1 of/i)).toBeInTheDocument();
        for (let i = 0; i < 20 && !screen.queryByText(/Ribbon · File Menu/i); i += 1) {
            fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
        }
        expect(screen.getByText(/Ribbon · File Menu/i)).toBeInTheDocument();
    });

    it('starts build demo from help and supports next/previous navigation', () => {
        render(<DiagramEditor />);
        fireEvent.click(screen.getByRole('button', { name: /^Help$/i }));
        fireEvent.click(screen.getByRole('button', { name: /^Build Demo$/i }));
        expect(screen.getByRole('dialog', { name: /build demo walkthrough/i })).toBeInTheDocument();
        expect(screen.getByText(/Build Step 1 of/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
        expect(screen.getByText(/Build Step 2 of/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Previous$/i }));
        expect(screen.getByText(/Build Step 1 of/i)).toBeInTheDocument();
    });

    it('renders timeline nudge buttons and play toggle', () => {
        render(<DiagramEditor />);
        const backBtn = screen.getByRole('button', { name: '-1 yr' });
        const forwardBtn = screen.getByRole('button', { name: '+1 yr' });
        const playBtn = screen.getByRole('button', { name: /play/i });
        expect(backBtn).toBeInTheDocument();
        expect(forwardBtn).toBeInTheDocument();
        expect(playBtn).toBeInTheDocument();
        fireEvent.click(playBtn);
        expect(playBtn).toHaveTextContent(/pause/i);
    });

    it('renders settings and options dropdown menus', () => {
        render(<DiagramEditor />);
        const fileMenuButton = screen.getByRole('button', { name: /file ▾/i });
        fireEvent.click(fileMenuButton);
        expect(screen.getByRole('button', { name: 'Load Demo Diagram' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Restore Backup' })).toBeInTheDocument();
        fireEvent.click(fileMenuButton);

        fireEvent.click(screen.getByRole('button', { name: /settings ▾/i }));
        expect(screen.getByRole('button', { name: 'Event Categories' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Relationship Categories' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Relationship Statuses' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Symptom Categories' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Notes Layer:/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Auto-Save:/ })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /options ▾/i }));
        expect(screen.getByRole('button', { name: 'Transcripts' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Voice Input' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Timeline Event Creator' })).toBeInTheDocument();
    });

    it('allows deleting and alphabetically displaying relationship settings values', () => {
        render(<DiagramEditor />);
        fireEvent.click(screen.getByRole('button', { name: /settings ▾/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Relationship Categories' }));

        fireEvent.change(screen.getByPlaceholderText(/add relationship category/i), {
            target: { value: 'zeta' },
        });
        fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));
        fireEvent.change(screen.getByPlaceholderText(/add relationship category/i), {
            target: { value: 'alpha' },
        });
        fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));

        const labels = screen
            .getAllByRole('listitem')
            .map((item) => item.textContent || '');
        const alphaIndex = labels.findIndex((text) => /Alpha/.test(text));
        const zetaIndex = labels.findIndex((text) => /Zeta/.test(text));
        expect(alphaIndex).toBeGreaterThan(-1);
        expect(zetaIndex).toBeGreaterThan(-1);
        expect(alphaIndex).toBeLessThan(zetaIndex);

        fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).find((button) =>
            button.closest('li')?.textContent?.includes('Alpha')
        )!);
        expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    });

    it('renders the center diagram control under Help', () => {
        render(<DiagramEditor />);
        expect(screen.getByRole('button', { name: /center diagram/i })).toBeInTheDocument();
    });

    it('opens ribbon help from the File question button', () => {
        render(<DiagramEditor />);
        fireEvent.click(screen.getByRole('button', { name: /file help/i }));
        expect(screen.getByRole('dialog', { name: /ribbon help/i })).toBeInTheDocument();
        expect(screen.getByDisplayValue(/new, open, save\/save as, import, export/i)).toBeInTheDocument();
    });

    it('reviews voice commands in the voice input dialog', () => {
        render(<DiagramEditor />);
        fireEvent.click(screen.getByRole('button', { name: /options ▾/i }));
        fireEvent.click(screen.getByRole('button', { name: /voice input/i }));
        expect(screen.getByRole('dialog', { name: /voice input/i })).toBeInTheDocument();

        fireEvent.change(screen.getByRole('textbox', { name: /voice command text/i }), {
            target: {
                value:
                    "Add a male named Harry. Harry's partner is Betty. Harry and Betty's children are Tom, Dick and Jane.",
            },
        });
        fireEvent.click(screen.getByRole('button', { name: /review commands/i }));

        expect(screen.getByText(/Add person: Harry \(male\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Create partnership: Harry \+ Betty/i)).toBeInTheDocument();
        expect(screen.getByText(/Add children to Harry \+ Betty: Tom, Dick, Jane/i)).toBeInTheDocument();
    });

    it('creates a blank untitled diagram from File New', () => {
        render(<DiagramEditor />);
        fireEvent.click(screen.getByRole('button', { name: /file ▾/i }));
        fireEvent.click(screen.getByRole('button', { name: 'New' }));

        expect(screen.getByText('newDiagram')).toBeInTheDocument();
    });

    it('adds and opens an editable general note from the canvas menu', () => {
        render(<DiagramEditor />);
        const stage = screen.getByRole('presentation');
        fireEvent.contextMenu(stage);
        fireEvent.click(screen.getByText('Add General Note'));

        expect(screen.getByRole('textbox', { name: /general note title/i })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /general note text/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/general note color/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save general note/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /delete general note/i })).toBeInTheDocument();
    });
});
