# Genogram Drawing Application

This is a web-based application for drawing genograms. A genogram is a visual representation of a family tree that includes information about relationships, medical history, and other significant life events.

## Implemented Features

*   **Create, modify, and delete people and partnerships:** Users can create, modify, and delete people and partnerships to build a genogram.
*   **Separated relationship type and status:** The application separates the concept of relationship type (e.g., married, dating) from relationship status (e.g., married, separated, divorced).
*   **Date fields:** The application supports date fields for relationship start, marriage, separation, and divorce.
*   **Adoption:** The application supports adoption, and adopted children are visually represented with a dashed line.
*   **Deceased individuals:** Deceased individuals are visually represented with an "X" through their node.
*   **Save and load:** Users can save their genogram to a JSON file and load it back into the application.
*   **Auto-save:** The application automatically saves the genogram data to `localStorage`.
*   **Export:** Users can export the genogram as a PNG or SVG image.
*   **Emotional Process Lines:** Users can create and style emotional process lines between individuals to represent different types of emotional bonds (e.g., fusion, conflict, distance, cutoff). Line styles and endings (arrows, perpendicular) are supported.

## How to Run the Application

1.  Navigate to the `src/frontend` directory.
2.  Install the dependencies: `npm install`
3.  Run the application in development mode: `npm run dev`
4.  Open a web browser and navigate to `http://localhost:5173/`.