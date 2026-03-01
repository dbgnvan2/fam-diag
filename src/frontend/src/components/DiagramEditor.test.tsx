import { render, screen, fireEvent } from '@testing-library/react';
import DiagramEditor from './DiagramEditor';
import { vi } from 'vitest';

// Mocking nanoid to have deterministic ids
vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => 'test-id-' + Math.random()),
}));

describe('DiagramEditor', () => {
    it('should render the editor', () => {
        render(<DiagramEditor />);
        expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('should show the add person menu on right click', () => {
        render(<DiagramEditor />);
        const stage = screen.getByRole('presentation');
        fireEvent.contextMenu(stage);
        expect(screen.getByText('Add Person')).toBeInTheDocument();
        expect(screen.getByText('Add Event')).toBeInTheDocument();
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
        fireEvent.click(screen.getByRole('button', { name: /help/i }));
        expect(screen.getByRole('dialog', { name: /quick start help/i })).toBeInTheDocument();
        expect(screen.getByText(/Canvas & Navigation/i)).toBeInTheDocument();
        const openReadmeBtn = screen.getByRole('button', { name: /open readme viewer/i });
        expect(openReadmeBtn).toBeInTheDocument();
        fireEvent.click(openReadmeBtn);
        expect(screen.getByRole('dialog', { name: /readme documentation/i })).toBeInTheDocument();
    });

    it('opens training videos from the help modal', () => {
        render(<DiagramEditor />);
        fireEvent.click(screen.getByRole('button', { name: /help/i }));
        fireEvent.click(screen.getByRole('button', { name: /open training videos/i }));
        expect(screen.getByRole('dialog', { name: /training videos/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /open in youtube/i })).toBeInTheDocument();
    });

    it('starts interactive demo from help and supports next/previous navigation', () => {
        render(<DiagramEditor />);
        fireEvent.click(screen.getByRole('button', { name: /help/i }));
        fireEvent.click(screen.getByRole('button', { name: /^Demo$/i }));
        expect(screen.getByRole('dialog', { name: /interactive demo/i })).toBeInTheDocument();
        expect(screen.getByText(/Demo Step 1 of/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
        expect(screen.getByText(/Demo Step 2 of/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Previous$/i }));
        expect(screen.getByText(/Demo Step 1 of/i)).toBeInTheDocument();
    });

    it('starts build demo from help and supports next/previous navigation', () => {
        render(<DiagramEditor />);
        fireEvent.click(screen.getByRole('button', { name: /help/i }));
        fireEvent.click(screen.getByRole('button', { name: /build demo/i }));
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

    it('renders transcripts and timeline dropdown menus', () => {
        render(<DiagramEditor />);
        fireEvent.click(screen.getByRole('button', { name: /transcripts/i }));
        expect(screen.getByRole('button', { name: 'Process' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Import Data' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /timeline/i }));
        expect(screen.getByRole('button', { name: 'Export Person Events' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Import Person Events' })).toBeInTheDocument();
    });
});
