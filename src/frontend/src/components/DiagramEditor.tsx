import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer } from 'react-konva';
import type { Person, Partnership, EmotionalLine } from '../types';
import PersonNode from './PersonNode';
import PartnershipNode from './PartnershipNode';
import ChildConnection from './ChildConnection';
import { nanoid } from 'nanoid';
import ContextMenu from './ContextMenu';
import type { KonvaEventObject } from 'konva/lib/Node';
import PropertiesPanel from './PropertiesPanel';
import EmotionalLineNode from './EmotionalLineNode';
import NoteNode from './NoteNode';
import { Stage as StageType } from 'konva/lib/Stage';
import { useAutosave } from '../hooks/useAutosave';

const p1_id = nanoid();
const p2_id = nanoid();
const child_id = nanoid();

const initialPeople: Person[] = [
  { id: p1_id, name: 'John Doe', x: 50, y: 50, gender: 'male', partnerships: ['p1'], birthDate: '1970-01-01' },
  { id: p2_id, name: 'Jane Doe', x: 250, y: 50, gender: 'female', partnerships: ['p1'], birthDate: '1972-03-15' },
  { id: child_id, name: 'Junior Doe', x: 150, y: 200, gender: 'male', parentPartnership: 'p1', partnerships: [], birthDate: '2000-05-20' },
];

const initialPartnerships: Partnership[] = [
    { id: 'p1', partner1_id: p1_id, partner2_id: p2_id, horizontalConnectorY: 150, relationshipType: 'married', relationshipStatus: 'married', relationshipStartDate: '1995-06-01', children: [child_id] }
];

const initialEmotionalLines: EmotionalLine[] = [];

const DiagramEditor = () => {
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [partnerships, setPartnerships] = useState<Partnership[]>(initialPartnerships);
  const [emotionalLines, setEmotionalLines] = useState<EmotionalLine[]>(initialEmotionalLines);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [selectedPartnershipId, setSelectedPartnershipId] = useState<string | null>(null);
  const [selectedEmotionalLineId, setSelectedEmotionalLineId] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: any[] } | null>(null);
  const [propertiesPanelItem, setPropertiesPanelItem] = useState<Person | Partnership | EmotionalLine | null>(null);
  const [eventCategories, setEventCategories] = useState<string[]>(['Job', 'School', 'Health', 'Relationship', 'Other']);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState('');
  const [timelinePersonId, setTimelinePersonId] = useState<string | null>(null);
  const [timelineSortOrder, setTimelineSortOrder] = useState<'asc' | 'desc'>('desc');
  const stageRef = useRef<StageType>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(220);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const dragGroupRef = useRef<{
    personId: string;
    startX: number;
    startY: number;
    selectedIds: string[];
    people: Map<string, { x: number; y: number; notesPosition?: { x: number; y: number } }>;
    partnerships: Map<string, { horizontalConnectorY: number; notesPosition?: { x: number; y: number } }>;
    emotionalLines: Map<string, { notesPosition?: { x: number; y: number } }>;
  } | null>(null);

  const normalizeEmotionalLines = (lines: EmotionalLine[]) =>
    lines.map((line) => {
      if (line.relationshipType === 'distance' && line.lineStyle === 'cutoff') {
        return { ...line, lineStyle: 'long-dash' };
      }
      if (line.relationshipType === 'cutoff' && line.lineStyle !== 'cutoff') {
        return { ...line, lineStyle: 'cutoff' };
      }
      return line;
    });

  useEffect(() => {
    const savedPeople = localStorage.getItem('genogram-people');
    const savedPartnerships = localStorage.getItem('genogram-partnerships');
    const savedEmotionalLines = localStorage.getItem('genogram-emotional-lines');
    const savedCategories = localStorage.getItem('genogram-event-categories');

    if (savedPeople && savedPartnerships && savedEmotionalLines) {
      setPeople(JSON.parse(savedPeople));
      setPartnerships(JSON.parse(savedPartnerships));
      setEmotionalLines(normalizeEmotionalLines(JSON.parse(savedEmotionalLines)));
    }

    if (savedCategories) {
      try {
        const parsed = JSON.parse(savedCategories);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEventCategories(parsed);
        }
      } catch {
        // ignore invalid categories
      }
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!panelRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const nextWidth = Math.round(entry.contentRect.width);
        setPanelWidth((prev) => (prev === nextWidth ? prev : nextWidth));
      }
    });
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeStateRef.current) return;
      const delta = resizeStateRef.current.startX - event.clientX;
      const nextWidth = Math.min(600, Math.max(180, resizeStateRef.current.startWidth + delta));
      setPanelWidth(nextWidth);
    };
    const handleMouseUp = () => {
      resizeStateRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useAutosave(
    people,
    (data) => {
      localStorage.setItem('genogram-people', JSON.stringify(data));
    },
    1000
  );

  useAutosave(
    partnerships,
    (data) => {
      localStorage.setItem('genogram-partnerships', JSON.stringify(data));
    },
    1000
  );

  useAutosave(
    emotionalLines,
    (data) => {
      localStorage.setItem('genogram-emotional-lines', JSON.stringify(data));
    },
    1000
  );

  useAutosave(
    eventCategories,
    (data) => {
      localStorage.setItem('genogram-event-categories', JSON.stringify(data));
    },
    1000
  );

  const handleUpdatePerson = (personId: string, updatedProps: Partial<Person>) => {
    console.log('Updating person:', personId, updatedProps);
    setPeople(people.map(p => 
        p.id === personId ? { ...p, ...updatedProps } : p
    ));
    setPropertiesPanelItem(prev => {
        if (prev && prev.id === personId && 'name' in prev) { // check if it is a person
            return { ...prev, ...updatedProps };
        }
        return prev;
    });
  };

  const handleUpdatePartnership = (partnershipId: string, updatedProps: Partial<Partnership>) => {
    console.log('Updating partnership:', partnershipId, updatedProps);
    setPartnerships(partnerships.map(p => 
        p.id === partnershipId ? { ...p, ...updatedProps } : p
    ));
    setPropertiesPanelItem(prev => {
        if (prev && prev.id === partnershipId && 'partner1_id' in prev) { // check if it is a partnership
            return { ...prev, ...updatedProps };
        }
        return prev;
    });
  };

  const handleUpdateEmotionalLine = (emotionalLineId: string, updatedProps: Partial<EmotionalLine>) => {
    console.log('Updating emotional line:', emotionalLineId, updatedProps);
    setEmotionalLines(emotionalLines.map(el => {
        if (el.id !== emotionalLineId) return el;
        const next = { ...el, ...updatedProps };
        if (next.relationshipType === 'distance' && next.lineStyle === 'cutoff') {
            next.lineStyle = 'long-dash';
        }
        if (next.relationshipType === 'cutoff' && next.lineStyle !== 'cutoff') {
            next.lineStyle = 'cutoff';
        }
        return next;
    }));
    setPropertiesPanelItem(prev => {
        if (prev && prev.id === emotionalLineId && 'lineStyle' in prev) { // check if it is an emotional line
            const next = { ...prev, ...updatedProps };
            if (next.relationshipType === 'distance' && next.lineStyle === 'cutoff') {
                next.lineStyle = 'long-dash';
            }
            if (next.relationshipType === 'cutoff' && next.lineStyle !== 'cutoff') {
                next.lineStyle = 'cutoff';
            }
            return next;
        }
        return prev;
    });
  };

  const addEmotionalLine = (person1_id: string, person2_id: string, relationshipType: EmotionalLine['relationshipType'], lineStyle: EmotionalLine['lineStyle'], lineEnding: EmotionalLine['lineEnding']) => {
    const newEmotionalLine: EmotionalLine = {
        id: nanoid(),
        person1_id,
        person2_id,
        relationshipType,
        lineStyle,
        lineEnding,
        startDate: new Date().toISOString().slice(0, 10),
        events: [],
    };
    setEmotionalLines([...emotionalLines, newEmotionalLine]);
  };

  const removeEmotionalLine = (emotionalLineId: string) => {
    setEmotionalLines(emotionalLines.filter(el => el.id !== emotionalLineId));
    setContextMenu(null);
  };

  const changeSex = (personId: string) => {
    setPeople(people.map(p => {
        if (p.id === personId) {
            return { ...p, gender: p.gender === 'male' ? 'female' : 'male' };
        }
        return p;
    }));
  };

  const addPartnership = () => {
    if (selectedPeopleIds.length !== 2) return;

    const [p1_id, p2_id] = selectedPeopleIds;
    const newPartnership: Partnership = {
        id: nanoid(),
        partner1_id: p1_id,
        partner2_id: p2_id,
        horizontalConnectorY: Math.max(people.find(p=>p.id === p1_id)!.y, people.find(p=>p.id === p2_id)!.y) + 100, // default y
        relationshipType: 'dating',
        relationshipStatus: 'married',
        children: [],
        events: [],
    };
    setPartnerships([...partnerships, newPartnership]);
  };

  const addChildToPartnership = () => {
    if (selectedPeopleIds.length !== 1 || !selectedPartnershipId) return;

    const childId = selectedPeopleIds[0];
    
    setPartnerships(partnerships.map(p => 
        p.id === selectedPartnershipId 
            ? { ...p, children: [...p.children, childId] } 
            : p
    ));

    setPeople(people.map(p => 
        p.id === childId 
            ? { ...p, parentPartnership: selectedPartnershipId } 
            : p
    ));

    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
  };

  const handleSave = () => {
    const diagramData = {
        people: people,
        partnerships: partnerships,
        emotionalLines: emotionalLines,
    };
    const jsonString = JSON.stringify(diagramData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = prompt("Enter a filename:", "genogram.json");
    if (filename) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    }
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const jsonString = event.target?.result as string;
        try {
            const data = JSON.parse(jsonString);
            if (data.people && data.partnerships && data.emotionalLines) {
                setPeople(data.people);
                setPartnerships(data.partnerships);
                setEmotionalLines(normalizeEmotionalLines(data.emotionalLines));
            } else {
                alert('Invalid file format');
            }
        } catch (error) {
            alert('Error parsing file');
        }
    };
    reader.readAsText(file);
    // Reset the input value to allow loading the same file again
    e.target.value = '';
  };

  const addPerson = (x: number, y: number) => {
    const newPerson: Person = {
      id: nanoid(),
      name: 'New Person',
      x: x,
      y: y,
      gender: 'female',
      partnerships: [],
      events: [],
    };
    setPeople([...people, newPerson]);
  };

  const removePartnership = (partnershipId: string) => {
    const partnershipToRemove = partnerships.find(p => p.id === partnershipId);
    if (!partnershipToRemove) return;

    setPartnerships(partnerships.filter(p => p.id !== partnershipId));

    setPeople(people.map(p => {
        if (p.id === partnershipToRemove.partner1_id || p.id === partnershipToRemove.partner2_id) {
            return { ...p, partnerships: p.partnerships.filter(pid => pid !== partnershipId) };
        }
        if (partnershipToRemove.children.includes(p.id)) {
            const newP = {...p};
            delete newP.parentPartnership;
            return newP;
        }
        return p;
    }));
    setContextMenu(null);
  };

  const removeChildFromPartnership = (childId: string, partnershipId: string) => {
    setPartnerships(partnerships.map(p => {
        if (p.id === partnershipId) {
            return { ...p, children: p.children.filter(id => id !== childId) };
        }
        return p;
    }));

    setPeople(people.map(p => {
        if (p.id === childId) {
            const newP = { ...p };
            delete newP.parentPartnership;
            return newP;
        }
        return p;
    }));
    setContextMenu(null);
  };

  const handlePersonContextMenu = (e: KonvaEventObject<PointerEvent>, person: Person) => {
      e.evt.preventDefault();
      console.log('selectedPeopleIds:', selectedPeopleIds);
      console.log('selectedPartnershipId:', selectedPartnershipId);
      
      const menuItems = [
          {
              label: `Change sex to ${person.gender === 'male' ? 'female' : 'male'}`,
              onClick: () => {
                  changeSex(person.id);
                  setContextMenu(null);
              }
          },
          {
            label: person.notes ? 'Disable Notes' : 'Enable Notes',
            onClick: () => {
                handleUpdatePerson(person.id, { notesEnabled: !person.notesEnabled });
                setContextMenu(null);
            }
          },
          {
            label: 'Properties',
            onClick: () => {
                setPropertiesPanelItem(person);
                setContextMenu(null);
            }
          },
          {
            label: 'Timeline',
            onClick: () => {
                setTimelinePersonId(person.id);
                setContextMenu(null);
            }
          }
      ];
      
      if (selectedPeopleIds.length === 2) {
        const [p1_id, p2_id] = selectedPeopleIds;
        menuItems.push({
            label: 'Add Partnership',
            onClick: () => {
                addPartnership();
                setContextMenu(null);
                setSelectedPeopleIds([]);
            }
        });
        menuItems.push({
            label: 'Add Emotional Line',
            onClick: () => {
                addEmotionalLine(p1_id, p2_id, 'fusion', 'single', 'none');
                setContextMenu(null);
                setSelectedPeopleIds([]);
            }
        });
      }

    if (selectedPeopleIds.length === 1 && selectedPartnershipId) {
        menuItems.push({
            label: 'Add as Child',
            onClick: () => {
                addChildToPartnership();
                setContextMenu(null);
            }
        });
    }

    if (person.parentPartnership) {
        menuItems.push({
            label: 'Remove as Child',
            onClick: () => {
                removeChildFromPartnership(person.id, person.parentPartnership!); 
                setContextMenu(null);
            }
        });
    }

      setContextMenu({
          x: e.evt.clientX,
          y: e.evt.clientY,
          items: menuItems,
      });
  };


  const handleChildLineContextMenu = (e: KonvaEventObject<PointerEvent>, childId: string, partnershipId: string) => {
    e.evt.preventDefault();
    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: [
            {
                label: 'Remove as Child',
                onClick: () => {
                    removeChildFromPartnership(childId, partnershipId);
                    setContextMenu(null);
                }
            }
        ]
    });
  };

  const handlePartnershipContextMenu = (e: KonvaEventObject<PointerEvent>, partnershipId: string) => {
    e.evt.preventDefault();
    const partnership = partnerships.find(p => p.id === partnershipId);
    if (!partnership) return;

    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: [
            {
                label: 'Remove Partnership',
                onClick: () => removePartnership(partnershipId)
            },
            {
              label: 'Properties',
              onClick: () => {
                  setPropertiesPanelItem(partnership);
                  setContextMenu(null);
              }
            }
        ]
    });
  };

  const handleStageContextMenu = (e: KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    if (e.target !== e.target.getStage()) {
        return;
    }
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;

    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: [
            {
                label: 'Add Person',
                onClick: () => {
                    addPerson(pointerPosition.x, pointerPosition.y);
                    setContextMenu(null);
                }
            }
        ]
    });
  };


  const handleExportPNG = () => {
    const uri = stageRef.current?.toDataURL();
    if (uri) {
      const a = document.createElement('a');
      a.href = uri;
      a.download = 'genogram.png';
      a.click();
    }
  };

  const handleExportSVG = () => {
    const uri = stageRef.current?.toDataURL({ mimeType: 'image/svg+xml' });
    if (uri) {
      const a = document.createElement('a');
      a.href = uri;
      a.download = 'genogram.svg';
      a.click();
    }
  };

  const handlePersonDragStart = (personId: string, x: number, y: number) => {
    if (!selectedPeopleIds.includes(personId) || selectedPeopleIds.length < 2) {
      dragGroupRef.current = null;
      return;
    }

    const selectedIds = [...selectedPeopleIds];
    const peopleMap = new Map<string, { x: number; y: number; notesPosition?: { x: number; y: number } }>();
    for (const person of people) {
      if (selectedIds.includes(person.id)) {
        peopleMap.set(person.id, {
          x: person.x,
          y: person.y,
          notesPosition: person.notesPosition ? { ...person.notesPosition } : undefined,
        });
      }
    }

    const partnershipsMap = new Map<string, { horizontalConnectorY: number; notesPosition?: { x: number; y: number } }>();
    for (const partnership of partnerships) {
      if (selectedIds.includes(partnership.partner1_id) && selectedIds.includes(partnership.partner2_id)) {
        partnershipsMap.set(partnership.id, {
          horizontalConnectorY: partnership.horizontalConnectorY,
          notesPosition: partnership.notesPosition ? { ...partnership.notesPosition } : undefined,
        });
      }
    }

    const emotionalLinesMap = new Map<string, { notesPosition?: { x: number; y: number } }>();
    for (const emotionalLine of emotionalLines) {
      if (selectedIds.includes(emotionalLine.person1_id) && selectedIds.includes(emotionalLine.person2_id)) {
        emotionalLinesMap.set(emotionalLine.id, {
          notesPosition: emotionalLine.notesPosition ? { ...emotionalLine.notesPosition } : undefined,
        });
      }
    }

    dragGroupRef.current = {
      personId,
      startX: x,
      startY: y,
      selectedIds,
      people: peopleMap,
      partnerships: partnershipsMap,
      emotionalLines: emotionalLinesMap,
    };
  };

  const handlePersonDrag = (personId: string, x: number, y: number) => {
    const dragGroup = dragGroupRef.current;
    if (dragGroup && dragGroup.personId === personId) {
      const dx = x - dragGroup.startX;
      const dy = y - dragGroup.startY;

      setPeople((prev) =>
        prev.map((person) => {
          const base = dragGroup.people.get(person.id);
          if (!base) return person;
          return {
            ...person,
            x: base.x + dx,
            y: base.y + dy,
            notesPosition: base.notesPosition
              ? { x: base.notesPosition.x + dx, y: base.notesPosition.y + dy }
              : person.notesPosition,
          };
        })
      );

      setPartnerships((prev) =>
        prev.map((partnership) => {
          const base = dragGroup.partnerships.get(partnership.id);
          if (!base) return partnership;
          return {
            ...partnership,
            horizontalConnectorY: base.horizontalConnectorY + dy,
            notesPosition: base.notesPosition
              ? { x: base.notesPosition.x + dx, y: base.notesPosition.y + dy }
              : partnership.notesPosition,
          };
        })
      );

      setEmotionalLines((prev) =>
        prev.map((line) => {
          const base = dragGroup.emotionalLines.get(line.id);
          if (!base) return line;
          return {
            ...line,
            notesPosition: base.notesPosition
              ? { x: base.notesPosition.x + dx, y: base.notesPosition.y + dy }
              : line.notesPosition,
          };
        })
      );
      return;
    }

    setPeople((prev) =>
      prev.map((person) => (person.id === personId ? { ...person, x, y } : person))
    );
  };

  const handleHorizontalConnectorDragEnd = (partnershipId: string, y: number) => {
    setPartnerships(
      partnerships.map((p) =>
        p.id === partnershipId ? { ...p, horizontalConnectorY: y } : p
      )
    );
  };

  const handlePersonNoteDragEnd = (personId: string, x: number, y: number) => {
    setPeople(
      people.map((person) =>
        person.id === personId ? { ...person, notesPosition: { x, y } } : person
      )
    );
  };

  const handlePartnershipNoteDragEnd = (partnershipId: string, x: number, y: number) => {
    setPartnerships(
      partnerships.map((p) =>
        p.id === partnershipId ? { ...p, notesPosition: { x, y } } : p
      )
    );
  };

  const handleEmotionalLineNoteDragEnd = (emotionalLineId: string, x: number, y: number) => {
    setEmotionalLines(
      emotionalLines.map((el) =>
        el.id === emotionalLineId ? { ...el, notesPosition: { x, y } } : el
      )
    );
  };



  const handleChildLineSelect = (childId: string) => {
    setSelectedChildId(childId);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setPropertiesPanelItem(null);
  };

  const handleEmotionalLineSelect = (emotionalLineId: string) => {
    if (selectedEmotionalLineId === emotionalLineId) {
        setSelectedEmotionalLineId(null);
        setPropertiesPanelItem(null); // also clear the properties panel
        return;
    }
    
    if (selectedPeopleIds.length > 0 || selectedPartnershipId) {
        setSelectedPeopleIds([]);
        setSelectedPartnershipId(null);
    }
    setSelectedEmotionalLineId(emotionalLineId);
    setSelectedChildId(null);

    const selectedLine = emotionalLines.find(el => el.id === emotionalLineId);
    if (selectedLine) {
        setPropertiesPanelItem(selectedLine);
    }
  };


  const handleEmotionalLineContextMenu = (e: KonvaEventObject<PointerEvent>, emotionalLineId: string) => {
    e.evt.preventDefault();
    setSelectedEmotionalLineId(emotionalLineId);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedChildId(null);
    const emotionalLine = emotionalLines.find(el => el.id === emotionalLineId);
    if (!emotionalLine) return;

    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: [
            {
                label: 'Remove Emotional Line',
                onClick: () => removeEmotionalLine(emotionalLineId)
            },
            {
              label: 'Properties',
              onClick: () => {
                  setPropertiesPanelItem(emotionalLine);
                  setContextMenu(null);
              }
            }
        ]
    });
  };

  const handleSelect = (personId: string, additive: boolean) => {
    if (additive) {
      if (selectedPeopleIds.includes(personId)) {
        setSelectedPeopleIds(selectedPeopleIds.filter((id) => id !== personId));
      } else {
        setSelectedPeopleIds([...selectedPeopleIds, personId]);
      }
      const selectedPerson = people.find((person) => person.id === personId);
      if (selectedPerson) {
        setPropertiesPanelItem(selectedPerson);
      }
      return;
    }

    setSelectedEmotionalLineId(null); // always deselect emotional lines when selecting a person
    if (selectedPartnershipId) {
      // we are in "add child" mode
      if (selectedPeopleIds.includes(personId)) {
        setSelectedPeopleIds([]);
      } else {
        setSelectedPeopleIds([personId]);
      }
    } else {
      // we are in "create partnership" mode
      if (selectedPeopleIds.includes(personId)) {
        setSelectedPeopleIds(selectedPeopleIds.filter(id => id !== personId));
      } else if (selectedPeopleIds.length < 2) {
        setSelectedPeopleIds([...selectedPeopleIds, personId]);
      }
    }

    const selectedPerson = people.find((person) => person.id === personId);
    if (selectedPerson) {
      setPropertiesPanelItem(selectedPerson);
    }
  };

  const handlePartnershipSelect = (partnershipId: string) => {
    setSelectedEmotionalLineId(null);
    if (selectedPartnershipId === partnershipId) {
        setSelectedPartnershipId(null);
        setPropertiesPanelItem(null);
    } else {
        setSelectedPartnershipId(partnershipId);
        setSelectedPeopleIds([]);
        const selectedPartnership = partnerships.find((p) => p.id === partnershipId);
        if (selectedPartnership) {
          setPropertiesPanelItem(selectedPartnership);
        }
    }
  };

      const timelinePerson = timelinePersonId ? people.find((p) => p.id === timelinePersonId) : null;
      const timelineItems = (() => {
        if (!timelinePerson) return [];
        const items: { id: string; date?: string; label: string; detail: string }[] = [];

        items.push({
          id: `person-${timelinePerson.id}-birth`,
          date: timelinePerson.birthDate,
          label: 'Person',
          detail: `Birth: ${timelinePerson.birthDate || '—'}`
        });
        if (timelinePerson.deathDate) {
          items.push({
            id: `person-${timelinePerson.id}-death`,
            date: timelinePerson.deathDate,
            label: 'Person',
            detail: `Death: ${timelinePerson.deathDate}`
          });
        }
        (timelinePerson.events || []).forEach((event) => {
          items.push({
            id: `person-event-${event.id}`,
            date: event.date,
            label: event.category || 'Event',
            detail: `Intensity ${event.intensity}, How well ${event.howWell}${event.otherPersonName ? `, Other: ${event.otherPersonName}` : ''}`
          });
        });

        const relatedPartnerships = partnerships.filter(
          (p) => p.partner1_id === timelinePerson.id || p.partner2_id === timelinePerson.id
        );
        relatedPartnerships.forEach((partnership) => {
          items.push({
            id: `partnership-${partnership.id}-start`,
            date: partnership.relationshipStartDate,
            label: partnership.relationshipType || 'Partnership',
            detail: `Relationship start: ${partnership.relationshipStartDate || '—'}`
          });
          if (partnership.marriedStartDate) {
            items.push({
              id: `partnership-${partnership.id}-married`,
              date: partnership.marriedStartDate,
              label: 'Marriage',
              detail: `Married: ${partnership.marriedStartDate}`
            });
          }
          if (partnership.separationDate) {
            items.push({
              id: `partnership-${partnership.id}-separation`,
              date: partnership.separationDate,
              label: 'Separation',
              detail: `Separated: ${partnership.separationDate}`
            });
          }
          if (partnership.divorceDate) {
            items.push({
              id: `partnership-${partnership.id}-divorce`,
              date: partnership.divorceDate,
              label: 'Divorce',
              detail: `Divorced: ${partnership.divorceDate}`
            });
          }
          (partnership.events || []).forEach((event) => {
            items.push({
              id: `partnership-event-${event.id}`,
              date: event.date,
              label: event.category || 'Event',
              detail: `Intensity ${event.intensity}, How well ${event.howWell}${event.otherPersonName ? `, Other: ${event.otherPersonName}` : ''}`
            });
          });
        });

        emotionalLines.forEach((line) => {
          if (line.person1_id !== timelinePerson.id && line.person2_id !== timelinePerson.id) return;
          const otherPersonId = line.person1_id === timelinePerson.id ? line.person2_id : line.person1_id;
          const otherPerson = people.find((p) => p.id === otherPersonId);
          items.push({
            id: `epl-${line.id}`,
            date: line.startDate,
            label: line.relationshipType || 'EPL',
            detail: `${line.relationshipType} (${line.lineStyle}) with ${otherPerson?.name || 'Unknown'}`
          });
          (line.events || []).forEach((event) => {
            items.push({
              id: `epl-event-${event.id}`,
              date: event.date,
              label: event.category || 'Event',
              detail: `Intensity ${event.intensity}, How well ${event.howWell}${event.otherPersonName ? `, Other: ${event.otherPersonName}` : ''}`
            });
          });
        });

        const direction = timelineSortOrder === 'asc' ? 1 : -1;
        return items.sort((a, b) => {
          const aTime = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
          const bTime = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
          if (aTime === bTime) return 0;
          return aTime > bTime ? direction : -direction;
        });
      })();

      return (
        <div>
                <div style={{ padding: 10, borderBottom: '1px solid #ccc' }}>
                  <button onClick={handleSave}>Save</button>
                  <input type="file" id="load-file" style={{ display: 'none' }} onChange={handleLoad} accept=".json" />
                  <label htmlFor="load-file" style={{ cursor: 'pointer', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginLeft: 10 }}>Load</label>
                  <button onClick={handleExportPNG}>Export as PNG</button>
                  <button onClick={handleExportSVG}>Export as SVG</button>
                  <button onClick={() => setSettingsOpen(true)} style={{ marginLeft: 10 }}>Event Categories</button>
                  <label style={{ marginLeft: 20 }}>
                    Zoom
                    <input
                      type="range"
                      min={0.25}
                      max={3}
                      step={0.05}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      style={{ marginLeft: 8, verticalAlign: 'middle' }}
                    />
                    <span style={{ marginLeft: 8 }}>{Math.round(zoom * 100)}%</span>
                  </label>
                </div>          <div style={{ display: 'flex' }}>
            {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
            <div style={{ flex: 1 }}>
              <Stage 
                ref={stageRef}
                width={Math.max(0, viewport.width - panelWidth)} 
                height={Math.max(0, viewport.height - 150)}
                scaleX={zoom}
                scaleY={zoom}
                onMouseDown={(e) => {
                  if (e.target === e.target.getStage()) {
                    setIsPanning(true);
                    const pointer = e.target.getStage()?.getPointerPosition();
                    if (pointer) {
                      panStartRef.current = { x: pointer.x, y: pointer.y };
                    }
                  }
                }}
                onMouseMove={(e) => {
                  if (!isPanning || !panStartRef.current) return;
                  const pointer = e.target.getStage()?.getPointerPosition();
                  if (!pointer) return;
                  const dx = (pointer.x - panStartRef.current.x) / zoom;
                  const dy = (pointer.y - panStartRef.current.y) / zoom;
                  setStagePosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
                  panStartRef.current = { x: pointer.x, y: pointer.y };
                }}
                onMouseUp={() => {
                  setIsPanning(false);
                  panStartRef.current = null;
                }}
                onMouseLeave={() => {
                  setIsPanning(false);
                  panStartRef.current = null;
                }}
                onTouchStart={(e) => {
                  if (e.target === e.target.getStage()) {
                    setIsPanning(true);
                    const pointer = e.target.getStage()?.getPointerPosition();
                    if (pointer) {
                      panStartRef.current = { x: pointer.x, y: pointer.y };
                    }
                  }
                }}
                onTouchMove={(e) => {
                  if (!isPanning || !panStartRef.current) return;
                  const pointer = e.target.getStage()?.getPointerPosition();
                  if (!pointer) return;
                  const dx = (pointer.x - panStartRef.current.x) / zoom;
                  const dy = (pointer.y - panStartRef.current.y) / zoom;
                  setStagePosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
                  panStartRef.current = { x: pointer.x, y: pointer.y };
                }}
                onTouchEnd={() => {
                  setIsPanning(false);
                  panStartRef.current = null;
                }}
                x={stagePosition.x}
                y={stagePosition.y}
                onClick={(e) => {
                  if (e.target === e.target.getStage()) {
                    setSelectedPeopleIds([]);
                    setSelectedPartnershipId(null);
                    setSelectedEmotionalLineId(null);
                    setSelectedChildId(null);
                  }
                }}
                onContextMenu={handleStageContextMenu}
              >
                <Layer>
                  {/* Render Emotional Lines */}
                  {emotionalLines.map((el) => {
                      const person1 = people.find(person => person.id === el.person1_id);
                      const person2 = people.find(person => person.id === el.person2_id);
                      if (!person1 || !person2) return null;
    
                      return (
                          <EmotionalLineNode
                              key={el.id}
                              emotionalLine={el}
                              person1={person1}
                              person2={person2}
                              isSelected={selectedEmotionalLineId === el.id}
                              onSelect={handleEmotionalLineSelect}
                              onContextMenu={handleEmotionalLineContextMenu}
                          />
                      )
                  })}

                  {/* Render Connections */}
                  {partnerships.map((p) => {
                      const partner1 = people.find(person => person.id === p.partner1_id);
                      const partner2 = people.find(person => person.id === p.partner2_id);
                      if (!partner1 || !partner2) return null;
    
                      const childConnections = p.children.map(childId => {
                          const child = people.find(c => c.id === childId);
                          if (!child) return null;
                          return <ChildConnection key={`child-conn-${childId}`} child={child} partnership={p} partner1={partner1} partner2={partner2} isSelected={selectedChildId === childId} onSelect={handleChildLineSelect} onContextMenu={handleChildLineContextMenu} />
                      });
    
                      return (
                          <React.Fragment key={p.id}>
                              <PartnershipNode 
                                  partnership={p} 
                                  partner1={partner1} 
                                  partner2={partner2} 
                                  isSelected={selectedPartnershipId === p.id}
                                  onSelect={handlePartnershipSelect}
                                  onHorizontalConnectorDragEnd={handleHorizontalConnectorDragEnd}
                                  onContextMenu={handlePartnershipContextMenu}
                              />
                              {childConnections}
                          </React.Fragment>
                      )
                  })}
    
                  {/* Render People */}
                  {people.map((person) => (
                    <PersonNode
                      key={person.id}
                      person={person}
                      isSelected={selectedPeopleIds.includes(person.id)}
                      onSelect={handleSelect}
                      onDragStart={(e) => handlePersonDragStart(person.id, e.target.x(), e.target.y())}
                      onDragMove={(e) => handlePersonDrag(person.id, e.target.x(), e.target.y())}
                      onDragEnd={(e) => {
                        handlePersonDrag(person.id, e.target.x(), e.target.y());
                        dragGroupRef.current = null;
                      }}
                      onContextMenu={handlePersonContextMenu}
                    />
                  ))}

                  {/* Render Notes */}
                  {people.map((person) => {
                    if (!person.notes || !person.notesEnabled) return null;
                    const x = person.notesPosition?.x || person.x + 50;
                    const y = person.notesPosition?.y || person.y;
                    return (
                      <NoteNode
                        key={`note-person-${person.id}`}
                        x={x}
                        y={y}
                        title={person.name}
                        text={person.notes}
                        anchorX={person.x}
                        anchorY={person.y}
                        onDragEnd={(e) => handlePersonNoteDragEnd(person.id, e.target.x(), e.target.y())}
                      />
                    );
                  })}
                  {partnerships.map((p) => {
                    if (!p.notes) return null;
                    const partner1 = people.find(person => person.id === p.partner1_id);
                    const partner2 = people.find(person => person.id === p.partner2_id);
                    if (!partner1 || !partner2) return null;
                    const x = p.notesPosition?.x || (partner1.x + partner2.x) / 2;
                    const y = p.notesPosition?.y || p.horizontalConnectorY + 50;
                    return (
                      <NoteNode
                        key={`note-partnership-${p.id}`}
                        x={x}
                        y={y}
                        title={`${partner1.name}\n${partner2.name}`}
                        text={p.notes}
                        anchorX={(partner1.x + partner2.x) / 2}
                        anchorY={p.horizontalConnectorY}
                        onDragEnd={(e) => handlePartnershipNoteDragEnd(p.id, e.target.x(), e.target.y())}
                      />
                    );
                  })}
                  {emotionalLines.map((el) => {
                    if (!el.notes) return null;
                    const person1 = people.find(person => person.id === el.person1_id);
                    const person2 = people.find(person => person.id === el.person2_id);
                    if (!person1 || !person2) return null;
                    const x = el.notesPosition?.x || (person1.x + person2.x) / 2;
                    const y = el.notesPosition?.y || (person1.y + person2.y) / 2 + 20;
                    return (
                      <NoteNode
                        key={`note-el-${el.id}`}
                        x={x}
                        y={y}
                        title={`${person1.name}\n${person2.name}`}
                        text={el.notes}
                        anchorX={(person1.x + person2.x) / 2}
                        anchorY={(person1.y + person2.y) / 2}
                        onDragEnd={(e) => handleEmotionalLineNoteDragEnd(el.id, e.target.x(), e.target.y())}
                      />
                    );
                  })}
                </Layer>
              </Stage>
            </div>
            <div
              ref={panelRef}
              style={{
                width: panelWidth,
                overflow: 'auto',
                minWidth: 180,
                maxWidth: 600,
                position: 'relative',
              }}
            >
              <div
                role="separator"
                aria-orientation="vertical"
                onMouseDown={(event) => {
                  resizeStateRef.current = { startX: event.clientX, startWidth: panelWidth };
                }}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 6,
                  cursor: 'col-resize',
                  background: 'linear-gradient(to right, rgba(0,0,0,0.15), rgba(0,0,0,0))',
                  borderRight: '1px solid #c7c7c7',
                }}
              />
              {propertiesPanelItem && (
                <PropertiesPanel
                  selectedItem={propertiesPanelItem}
                  people={people}
                  eventCategories={eventCategories}
                  onUpdatePerson={handleUpdatePerson}
                  onUpdatePartnership={handleUpdatePartnership}
                  onUpdateEmotionalLine={handleUpdateEmotionalLine}
                  onClose={() => setPropertiesPanelItem(null)}
                />
              )}
            </div>
          </div>
          {settingsOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000,
              }}
            >
              <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 360 }}>
                <h4>Event Categories</h4>
                <div style={{ marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Add category"
                    value={settingsDraft}
                    onChange={(e) => setSettingsDraft(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      const trimmed = settingsDraft.trim();
                      if (!trimmed) return;
                      if (!eventCategories.includes(trimmed)) {
                        setEventCategories([...eventCategories, trimmed]);
                      }
                      setSettingsDraft('');
                    }}
                    style={{ marginLeft: 6 }}
                  >
                    Add
                  </button>
                </div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {eventCategories.map((category) => (
                    <li key={category} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{category}</span>
                      <button onClick={() => setEventCategories(eventCategories.filter((c) => c !== category))}>Remove</button>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button onClick={() => setSettingsOpen(false)}>Close</button>
                </div>
              </div>
            </div>
          )}
          {timelinePerson && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2100,
              }}
            >
              <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 640, maxHeight: '80vh', overflow: 'auto' }}>
                <h4>Timeline: {timelinePerson.name}</h4>
                <div style={{ marginBottom: 8 }}>
                  <label htmlFor="timelineSortOrder">Sort: </label>
                  <select
                    id="timelineSortOrder"
                    value={timelineSortOrder}
                    onChange={(e) => setTimelineSortOrder(e.target.value as 'asc' | 'desc')}
                  >
                    <option value="asc">Date Asc</option>
                    <option value="desc">Date Desc</option>
                  </select>
                </div>
                {timelineItems.length === 0 ? (
                  <div style={{ fontStyle: 'italic' }}>No timeline items.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '4px 6px' }}>Nodal/EPE</th>
                        {timelineItems.map((item) => (
                          <th key={`head-${item.id}`} style={{ textAlign: 'center', borderBottom: '1px solid #ddd', padding: '4px 6px' }}>
                            {item.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}><strong>Year</strong></td>
                        {timelineItems.map((item) => {
                          const year = item.date ? item.date.split('-')[0] : '';
                          return (
                            <td key={`year-${item.id}`} style={{ textAlign: 'center', padding: '4px 6px', borderBottom: '1px solid #eee' }}>
                              {year || '—'}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 6px' }}><strong>Date</strong></td>
                        {timelineItems.map((item) => {
                          const date = item.date ? item.date.split('-').slice(1).join('-') : '';
                          return (
                            <td key={`date-${item.id}`} style={{ textAlign: 'center', padding: '4px 6px' }}>
                              {date || '—'}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 6px' }}><strong>Intensity</strong></td>
                        {timelineItems.map((item) => {
                          const intensityMatch = item.detail.match(/Intensity (\d+)/);
                          const intensity = intensityMatch ? intensityMatch[1] : '';
                          return (
                            <td key={`intensity-${item.id}`} style={{ textAlign: 'center', padding: '4px 6px' }}>
                              {intensity || '—'}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button onClick={() => setTimelinePersonId(null)}>Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };export default DiagramEditor;
