import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Stage, Layer } from 'react-konva';
import type { Person, Partnership, EmotionalLine, FunctionalIndicatorDefinition } from '../types';
import PersonNode from './PersonNode';
import PartnershipNode from './PartnershipNode';
import ChildConnection from './ChildConnection';
import { nanoid } from 'nanoid';
import ContextMenu from './ContextMenu';
import type { KonvaEventObject } from 'konva/lib/Node';
import PropertiesPanel from './PropertiesPanel';
import MultiPersonPropertiesPanel from './MultiPersonPropertiesPanel';
import EmotionalLineNode from './EmotionalLineNode';
import NoteNode from './NoteNode';
import { Stage as StageType } from 'konva/lib/Stage';
import { useAutosave } from '../hooks/useAutosave';
import { removeOrphanedMiscarriages } from '../utils/dataCleanup';
import { getSaveButtonState } from '../utils/saveButtonState';

const p1_id = nanoid();
const p2_id = nanoid();
const child_id = nanoid();
const defaultFunctionalIndicators: FunctionalIndicatorDefinition[] = [
  { id: 'indicator-affair', label: 'Affair' },
  { id: 'indicator-su', label: 'Substance Use' },
  { id: 'indicator-gambling', label: 'Gambling' },
];

const buildAllowedIndicatorSet = (defs: FunctionalIndicatorDefinition[]) =>
  new Set(defs.map((def) => def.id));

const sanitizePersonIndicatorsWithSet = (person: Person, allowed: Set<string>) => {
  if (!person.functionalIndicators || person.functionalIndicators.length === 0) {
    return person;
  }
  const filtered = person.functionalIndicators.filter((entry) => allowed.has(entry.definitionId));
  if (filtered.length === person.functionalIndicators.length) {
    return person;
  }
  const updated: Person = { ...person };
  if (filtered.length) {
    updated.functionalIndicators = filtered;
  } else {
    delete (updated as any).functionalIndicators;
  }
  return updated;
};

const sanitizePeopleIndicators = (peopleList: Person[], defs: FunctionalIndicatorDefinition[]) => {
  if (!peopleList.length) return peopleList;
  const allowed = buildAllowedIndicatorSet(defs);
  if (allowed.size === 0) {
    let changed = false;
    const next = peopleList.map((person) => {
      if (!person.functionalIndicators || person.functionalIndicators.length === 0) {
        return person;
      }
      changed = true;
      const updated = { ...person };
      delete (updated as any).functionalIndicators;
      return updated;
    });
    return changed ? next : peopleList;
  }
  let changed = false;
  const next = peopleList.map((person) => {
    const sanitized = sanitizePersonIndicatorsWithSet(person, allowed);
    if (sanitized !== person) {
      changed = true;
    }
    return sanitized;
  });
  return changed ? next : peopleList;
};

const sanitizeSinglePersonIndicators = (person: Person, defs: FunctionalIndicatorDefinition[]) => {
  const allowed = buildAllowedIndicatorSet(defs);
  return sanitizePersonIndicatorsWithSet(person, allowed);
};

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
  const DEFAULT_LINE_COLOR = '#444444';
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [partnerships, setPartnerships] = useState<Partnership[]>(initialPartnerships);
  const [emotionalLines, setEmotionalLines] = useState<EmotionalLine[]>(initialEmotionalLines);
  const [fileName, setFileName] = useState(() => {
    if (typeof window === 'undefined') return 'Untitled';
    return localStorage.getItem('genogram-file-name') || 'Untitled';
  });
  const [autoSaveMinutes, setAutoSaveMinutes] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const stored = localStorage.getItem('genogram-autosave-minutes');
    const parsed = stored ? Number(stored) : 1;
    return !Number.isFinite(parsed) || parsed <= 0 ? 1 : parsed;
  });
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [selectedPartnershipId, setSelectedPartnershipId] = useState<string | null>(null);
  const [selectedEmotionalLineId, setSelectedEmotionalLineId] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: any[] } | null>(null);
  const [propertiesPanelItem, setPropertiesPanelItem] = useState<Person | Partnership | EmotionalLine | null>(null);
  const [eventCategories, setEventCategories] = useState<string[]>(['Job', 'School', 'Health', 'Relationship', 'Other']);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [lastDirtyTimestamp, setLastDirtyTimestamp] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [functionalIndicatorDefinitions, setFunctionalIndicatorDefinitions] = useState<FunctionalIndicatorDefinition[]>(defaultFunctionalIndicators);
  const [indicatorSettingsOpen, setIndicatorSettingsOpen] = useState(false);
  const [indicatorDraftLabel, setIndicatorDraftLabel] = useState('');
  const [indicatorDraftIcon, setIndicatorDraftIcon] = useState<string | null>(null);
  const [timelinePersonId, setTimelinePersonId] = useState<string | null>(null);
  const [timelineSortOrder, setTimelineSortOrder] = useState<'asc' | 'desc'>('desc');
  const stageRef = useRef<StageType>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const DEFAULT_PANEL_WIDTH = 360;
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
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
  const savedSnapshotRef = useRef(
    JSON.stringify({
      people: initialPeople,
      partnerships: initialPartnerships,
      emotionalLines: initialEmotionalLines,
    })
  );
  const fileMenuRef = useRef<HTMLDivElement | null>(null);
  const loadInputRef = useRef<HTMLInputElement | null>(null);
  const [, forceTimeRefresh] = useState(0);
  const multiSelectedPeople = useMemo(
    () => people.filter((person) => selectedPeopleIds.includes(person.id)),
    [people, selectedPeopleIds]
  );
  const showMultiPersonPanel = multiSelectedPeople.length > 1;
  const serializeDiagram = useCallback(
    (peopleData: Person[], partnershipData: Partnership[], emotionalData: EmotionalLine[]) =>
      JSON.stringify({ people: peopleData, partnerships: partnershipData, emotionalLines: emotionalData }),
    []
  );
  const markSnapshotClean = useCallback(
    (peopleData: Person[], partnershipData: Partnership[], emotionalData: EmotionalLine[]) => {
      savedSnapshotRef.current = serializeDiagram(peopleData, partnershipData, emotionalData);
      setIsDirty(false);
      setLastDirtyTimestamp(null);
    },
    [serializeDiagram]
  );

  useEffect(() => {
    const snapshot = serializeDiagram(people, partnerships, emotionalLines);
    if (snapshot !== savedSnapshotRef.current) {
      if (!isDirty) {
        setIsDirty(true);
        setLastDirtyTimestamp(Date.now());
      }
    } else if (isDirty) {
      setIsDirty(false);
      setLastDirtyTimestamp(null);
    }
  }, [people, partnerships, emotionalLines, isDirty, serializeDiagram]);

  useEffect(() => {
    if (!fileMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
        setFileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [fileMenuOpen]);

  useEffect(() => {
    localStorage.setItem('genogram-file-name', fileName);
  }, [fileName]);

  useEffect(() => {
    localStorage.setItem('genogram-autosave-minutes', String(autoSaveMinutes));
  }, [autoSaveMinutes]);

  useEffect(() => {
    if (!isDirty) return;
    const interval = setInterval(() => forceTimeRefresh(Date.now()), 500);
    return () => clearInterval(interval);
  }, [isDirty, forceTimeRefresh]);
  const syncPropertiesPanelIndicators = (defs: FunctionalIndicatorDefinition[]) => {
    setPropertiesPanelItem((prev) => {
      if (prev && 'name' in prev) {
        return sanitizeSinglePersonIndicators(prev as Person, defs);
      }
      return prev;
    });
  };
  const applyIndicatorDefinitionArray = (nextDefs: FunctionalIndicatorDefinition[]) => {
    setFunctionalIndicatorDefinitions(nextDefs);
    setPeople((prev) => sanitizePeopleIndicators(prev, nextDefs));
    syncPropertiesPanelIndicators(nextDefs);
  };

  const updateIndicatorDefinitions = (
    updater: (prev: FunctionalIndicatorDefinition[]) => FunctionalIndicatorDefinition[]
  ) => {
    setFunctionalIndicatorDefinitions((prev) => {
      const next = updater(prev);
      setPeople((peoplePrev) => sanitizePeopleIndicators(peoplePrev, next));
      syncPropertiesPanelIndicators(next);
      return next;
    });
  };

  const resetIndicatorDraft = () => {
    setIndicatorDraftLabel('');
    setIndicatorDraftIcon(null);
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const addFunctionalIndicatorDefinition = () => {
    const trimmed = indicatorDraftLabel.trim();
    if (!trimmed) return;
    updateIndicatorDefinitions((prev) => [
      ...prev,
      { id: nanoid(), label: trimmed, iconDataUrl: indicatorDraftIcon || undefined },
    ]);
    resetIndicatorDraft();
  };

  const updateFunctionalIndicatorLabel = (id: string, label: string) => {
    updateIndicatorDefinitions((prev) =>
      prev.map((definition) => (definition.id === id ? { ...definition, label } : definition))
    );
  };

  const updateFunctionalIndicatorIcon = async (id: string, file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      updateIndicatorDefinitions((prev) =>
        prev.map((definition) =>
          definition.id === id ? { ...definition, iconDataUrl: dataUrl } : definition
        )
      );
    } catch (error) {
      console.error('Failed to read icon file', error);
    }
  };

  const clearFunctionalIndicatorIcon = (id: string) => {
    updateIndicatorDefinitions((prev) =>
      prev.map((definition) =>
        definition.id === id ? { ...definition, iconDataUrl: undefined } : definition
      )
    );
  };

  const removeFunctionalIndicatorDefinition = (id: string) => {
    updateIndicatorDefinitions((prev) => prev.filter((definition) => definition.id !== id));
  };

  const handleIndicatorDraftIconChange = async (file: File | null) => {
    if (!file) {
      setIndicatorDraftIcon(null);
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setIndicatorDraftIcon(dataUrl);
    } catch (error) {
      console.error('Failed to read icon file', error);
    }
  };
  const STYLE_ONLY_FIELDS = useMemo(
    () =>
      new Set<keyof Person>([
        'size',
        'borderColor',
        'backgroundColor',
        'backgroundEnabled',
        'functionalIndicators',
      ]),
    []
  );
  const isStyleOnlyUpdate = (updates: Partial<Person>) => {
    const keys = Object.keys(updates) as (keyof Person)[];
    if (!keys.length) return false;
    return keys.every((key) => STYLE_ONLY_FIELDS.has(key));
  };

  const alignAllAnchors = (list: Person[]) => {
    if (!partnerships.length) return list;
    const personLookup = new Map(list.map((p) => [p.id, p]));
    const partnershipRanges = new Map<string, { min: number; max: number }>();
    partnerships.forEach((partnership) => {
      const partner1 = personLookup.get(partnership.partner1_id);
      const partner2 = personLookup.get(partnership.partner2_id);
      if (!partner1 || !partner2) return;
      partnershipRanges.set(partnership.id, {
        min: Math.min(partner1.x, partner2.x),
        max: Math.max(partner1.x, partner2.x),
      });
    });

    const multiGroupMembers = new Map<
      string,
      { partnershipId: string; members: Person[] }
    >();
    list.forEach((person) => {
      if (!person.parentPartnership) return;
      if (!person.multipleBirthGroupId) return;
      const current = multiGroupMembers.get(person.multipleBirthGroupId);
      if (current) {
        current.members.push(person);
      } else {
        multiGroupMembers.set(person.multipleBirthGroupId, {
          partnershipId: person.parentPartnership,
          members: [person],
        });
      }
    });

    const derivedAssignments = new Map<string, string>();
    const anchorClusters = new Map<string, Person[]>();
    list.forEach((person) => {
      if (!person.parentPartnership) return;
      if (person.multipleBirthGroupId) return;
      if (typeof person.connectionAnchorX !== 'number') return;
      const key = `${person.parentPartnership}:${person.connectionAnchorX.toFixed(2)}`;
      const group = anchorClusters.get(key);
      if (group) {
        group.push(person);
      } else {
        anchorClusters.set(key, [person]);
      }
    });
    anchorClusters.forEach((members) => {
      if (members.length < 2) return;
      const newGroupId = nanoid();
      members.forEach((member) => {
        derivedAssignments.set(member.id, newGroupId);
      });
      multiGroupMembers.set(newGroupId, {
        partnershipId: members[0].parentPartnership!,
        members,
      });
    });

    const anchorByPerson = new Map<string, number>();
    const clampValue = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));

    multiGroupMembers.forEach(({ partnershipId, members }) => {
      if (members.length < 2) {
        return;
      }
      const range = partnershipRanges.get(partnershipId);
      if (!range) return;
      const center =
        members.reduce((sum, member) => sum + member.x, 0) / members.length;
      const anchor = clampValue(center, range.min, range.max);
      members.forEach((member) => {
        anchorByPerson.set(member.id, anchor);
      });
    });

    let changed = false;
    const next = list.map((person) => {
      let updated = person;
      const derivedGroupId = derivedAssignments.get(person.id);
      if (derivedGroupId && person.multipleBirthGroupId !== derivedGroupId) {
        updated = { ...updated, multipleBirthGroupId: derivedGroupId };
        changed = true;
      }

      const targetAnchor = anchorByPerson.get(person.id);
      if (typeof targetAnchor === 'number') {
        if (updated.connectionAnchorX !== targetAnchor) {
          updated = { ...updated, connectionAnchorX: targetAnchor };
          changed = true;
        }
        return updated;
      }

      if (updated.connectionAnchorX !== undefined) {
        updated = { ...updated };
        delete updated.connectionAnchorX;
        changed = true;
      }
      return updated;
    });

    return changed ? next : list;
  };

  const setPeopleAligned = (updater: (prev: Person[]) => Person[]) => {
    setPeople((prev) => alignAllAnchors(updater(prev)));
  };

  const translateDiagram = (dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    setPeopleAligned((prev) =>
      prev.map((person) => {
        const next: Person = {
          ...person,
          x: person.x + dx,
          y: person.y + dy,
          notesPosition: person.notesPosition
            ? { x: person.notesPosition.x + dx, y: person.notesPosition.y + dy }
            : undefined,
        };
        if (typeof person.connectionAnchorX === 'number') {
          next.connectionAnchorX = person.connectionAnchorX + dx;
        }
        return next;
      })
    );
    setPartnerships((prev) =>
      prev.map((partnership) => ({
        ...partnership,
        horizontalConnectorY: partnership.horizontalConnectorY + dy,
        notesPosition: partnership.notesPosition
          ? { x: partnership.notesPosition.x + dx, y: partnership.notesPosition.y + dy }
          : undefined,
      }))
    );
    setEmotionalLines((prev) =>
      prev.map((line) => ({
        ...line,
        notesPosition: line.notesPosition
          ? { x: line.notesPosition.x + dx, y: line.notesPosition.y + dy }
          : undefined,
      }))
    );
  };

  type EmotionalLineInput = Partial<EmotionalLine> & { lineStyle?: string; color?: string };

  const normalizeEmotionalLines = (lines: EmotionalLineInput[]): EmotionalLine[] =>
    lines.map((line) => {
      let normalized = { ...line } as EmotionalLine;
      if (normalized.relationshipType === 'distance' && normalized.lineStyle === 'cutoff') {
        normalized = { ...normalized, lineStyle: 'long-dash' };
      }
      if (normalized.relationshipType === 'cutoff' && normalized.lineStyle !== 'cutoff') {
        normalized = { ...normalized, lineStyle: 'cutoff' };
      }
      if (normalized.relationshipType === 'fusion') {
        const legacyMap: Record<string, EmotionalLine['lineStyle']> = {
          single: 'low',
          double: 'medium',
          triple: 'high',
        };
        const mapped = legacyMap[(normalized.lineStyle as unknown as string)] || null;
        if (mapped) {
          normalized = { ...normalized, lineStyle: mapped };
        }
      }
      if (!normalized.color) {
        normalized = { ...normalized, color: DEFAULT_LINE_COLOR };
      }
      return normalized;
    });

  useEffect(() => {
    const savedPeople = localStorage.getItem('genogram-people');
    const savedPartnerships = localStorage.getItem('genogram-partnerships');
    const savedEmotionalLines = localStorage.getItem('genogram-emotional-lines');
    const savedCategories = localStorage.getItem('genogram-event-categories');
    const savedIndicators = localStorage.getItem('genogram-functional-indicators');
    let indicatorDefs = defaultFunctionalIndicators;
    if (savedIndicators) {
      try {
        const parsed = JSON.parse(savedIndicators);
        if (Array.isArray(parsed)) {
          indicatorDefs = parsed;
        }
      } catch {
        // ignore malformed indicator definitions
      }
    }
    applyIndicatorDefinitionArray(indicatorDefs);

    if (savedPeople && savedPartnerships && savedEmotionalLines) {
      const parsedPeople: Person[] = JSON.parse(savedPeople);
      const parsedPartnerships: Partnership[] = JSON.parse(savedPartnerships);
      const parsedLines: EmotionalLine[] = JSON.parse(savedEmotionalLines);
      const cleaned = removeOrphanedMiscarriages(parsedPeople, parsedPartnerships);
      const aligned = alignAllAnchors(cleaned.people);
      const normalizedLines = normalizeEmotionalLines(parsedLines);
      const sanitizedPeople = sanitizePeopleIndicators(aligned, indicatorDefs);
      setPeople(sanitizedPeople);
      setPartnerships(cleaned.partnerships);
      setEmotionalLines(normalizedLines);
      markSnapshotClean(sanitizedPeople, cleaned.partnerships, normalizedLines);
    } else {
      markSnapshotClean(initialPeople, initialPartnerships, initialEmotionalLines);
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

  const autosaveDelayMs = Math.max(0.1, autoSaveMinutes) * 60000;

  const clampAutoSaveMinutes = (value: number) => {
    if (!Number.isFinite(value)) {
      return 1;
    }
    return Math.max(0.25, Math.min(180, value));
  };

  const handleAutoSaveMinutesInput = (value: number) => {
    setAutoSaveMinutes(clampAutoSaveMinutes(value));
  };

  useAutosave(
    people,
    (data) => {
      localStorage.setItem('genogram-people', JSON.stringify(data));
    },
    autosaveDelayMs
  );

  useAutosave(
    partnerships,
    (data) => {
      localStorage.setItem('genogram-partnerships', JSON.stringify(data));
    },
    autosaveDelayMs
  );

  useAutosave(
    emotionalLines,
    (data) => {
      localStorage.setItem('genogram-emotional-lines', JSON.stringify(data));
    },
    autosaveDelayMs
  );

  useAutosave(
    eventCategories,
    (data) => {
      localStorage.setItem('genogram-event-categories', JSON.stringify(data));
    },
    autosaveDelayMs
  );

  useAutosave(
    functionalIndicatorDefinitions,
    (data) => {
      localStorage.setItem('genogram-functional-indicators', JSON.stringify(data));
    },
    autosaveDelayMs
  );

  const handleUpdatePerson = (personId: string, updatedProps: Partial<Person>) => {
    console.log('Updating person:', personId, updatedProps);
    const updater = (prev: Person[]) =>
      prev.map((p) => (p.id === personId ? { ...p, ...updatedProps } : p));
    if (isStyleOnlyUpdate(updatedProps)) {
      setPeople((prev) => updater(prev));
    } else {
      setPeopleAligned((prev) => updater(prev));
    }
    setPropertiesPanelItem(prev => {
        if (prev && prev.id === personId && 'name' in prev) { // check if it is a person
            return { ...prev, ...updatedProps };
        }
        return prev;
    });
  };

  const handleBatchUpdatePersons = (personIds: string[], updatedProps: Partial<Person>) => {
    if (!personIds.length) return;
    const updater = (prev: Person[]) =>
      prev.map((person) =>
        personIds.includes(person.id) ? { ...person, ...updatedProps } : person
      );
    if (isStyleOnlyUpdate(updatedProps)) {
      setPeople((prev) => updater(prev));
    } else {
      setPeopleAligned((prev) => updater(prev));
    }
    setPropertiesPanelItem((prev) => {
      if (prev && 'name' in prev && personIds.includes(prev.id)) {
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
        color: DEFAULT_LINE_COLOR,
        events: [],
    };
    setEmotionalLines([...emotionalLines, newEmotionalLine]);
  };

  const removeEmotionalLine = (emotionalLineId: string) => {
    setEmotionalLines(emotionalLines.filter(el => el.id !== emotionalLineId));
    setContextMenu(null);
  };

  const changeSex = (personId: string) => {
    setPeopleAligned(prev =>
      prev.map(p =>
        p.id === personId ? { ...p, gender: p.gender === 'male' ? 'female' : 'male' } : p
      )
    );
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

  const addChildToPartnership = (childIdOverride?: string, partnershipIdOverride?: string) => {
    const childId =
      childIdOverride ?? (selectedPeopleIds.length === 1 ? selectedPeopleIds[0] : null);
    const partnershipId = partnershipIdOverride ?? selectedPartnershipId;
    if (!childId || !partnershipId) {
      alert('Select a partnership first to add this child.');
      return;
    }

    setPartnerships((prev) =>
      prev.map((p) =>
        p.id === partnershipId ? { ...p, children: [...p.children, childId] } : p
      )
    );

    setPeopleAligned((prev) =>
      prev.map((p) =>
        p.id === childId
          ? { ...p, parentPartnership: partnershipId, connectionAnchorX: undefined }
          : p
      )
    );

    setSelectedPeopleIds((ids) => ids.filter((id) => id !== childId));
    setSelectedPartnershipId((current) => (current === partnershipId ? null : current));
  };

  const buildDiagramPayload = () => ({
    fileMeta: {
      fileName,
      exportedAt: new Date().toISOString(),
    },
    people,
    partnerships,
    emotionalLines,
    functionalIndicatorDefinitions,
    eventCategories,
    autoSaveMinutes,
  });

  const handleSave = (forcePrompt = false) => {
    let targetName = fileName;
    if (forcePrompt || !targetName || targetName === 'Untitled') {
      const proposed = targetName && targetName !== 'Untitled' ? targetName : 'family-diagram.json';
      const userInput = prompt('Enter a filename:', proposed);
      if (!userInput) return;
      targetName = userInput;
    }
    if (!targetName.toLowerCase().endsWith('.json')) {
      targetName = `${targetName}.json`;
    }
    const diagramData = buildDiagramPayload();
    const jsonString = JSON.stringify(diagramData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = targetName;
    a.click();
    URL.revokeObjectURL(url);
    setFileName(targetName);
    markSnapshotClean(people, partnerships, emotionalLines);
    setLastSavedAt(Date.now());
  };

  const handleSaveAs = () => handleSave(true);

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const jsonString = event.target?.result as string;
        try {
            const data = JSON.parse(jsonString);
            if (data.people && data.partnerships && data.emotionalLines) {
                const nextDefinitions: FunctionalIndicatorDefinition[] = Array.isArray(data.functionalIndicatorDefinitions)
                  ? data.functionalIndicatorDefinitions
                  : functionalIndicatorDefinitions;
                applyIndicatorDefinitionArray(nextDefinitions);
                const cleaned = removeOrphanedMiscarriages(data.people, data.partnerships);
                const aligned = alignAllAnchors(cleaned.people);
                setPeople(sanitizePeopleIndicators(aligned, nextDefinitions));
                setPartnerships(cleaned.partnerships);
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

  const buildInitialStateSnapshot = () => {
    const clonedPeople = initialPeople.map((person) => ({
      ...person,
      partnerships: [...person.partnerships],
      events: person.events ? [...person.events] : [],
    }));
    const clonedPartnerships = initialPartnerships.map((partnership) => ({
      ...partnership,
      children: [...partnership.children],
    }));
    const clonedLines = initialEmotionalLines.map((line) => ({ ...line }));
    return { clonedPeople, clonedPartnerships, clonedLines };
  };

  const resetDiagramToInitialState = useCallback(() => {
    const { clonedPeople, clonedPartnerships, clonedLines } = buildInitialStateSnapshot();
    setPeople(clonedPeople);
    setPartnerships(clonedPartnerships);
    setEmotionalLines(clonedLines);
    setPropertiesPanelItem(null);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setContextMenu(null);
    setTimelinePersonId(null);
    setFileName('Untitled');
    markSnapshotClean(clonedPeople, clonedPartnerships, clonedLines);
    setLastSavedAt(null);
  }, [markSnapshotClean]);

  const handleNewFile = () => {
    if (isDirty) {
      const confirmReset = window.confirm(
        'Start a new family diagram? Unsaved changes will be lost.'
      );
      if (!confirmReset) {
        return;
      }
    }
    resetDiagramToInitialState();
  };

  const handleOpenFilePicker = () => {
    loadInputRef.current?.click();
  };

  const handleQuit = () => {
    const confirmQuit = window.confirm(
      'Quit the Family Diagram Maker? Unsaved changes will be lost.'
    );
    if (confirmQuit) {
      window.close();
    }
  };

  const addPerson = (x: number, y: number, overrides: Partial<Person> = {}) => {
    const newPerson: Person = {
      id: overrides.id ?? nanoid(),
      name: overrides.name ?? 'New Person',
      x,
      y,
      gender: overrides.gender ?? 'female',
      partnerships: overrides.partnerships ?? [],
      parentPartnership: overrides.parentPartnership,
      lifeStatus: overrides.lifeStatus ?? 'alive',
      connectionAnchorX: overrides.connectionAnchorX,
      multipleBirthGroupId: overrides.multipleBirthGroupId,
      notes: overrides.notes,
      notesPosition: overrides.notesPosition,
      notesEnabled: overrides.notesEnabled,
      events: overrides.events ?? [],
    };
    setPeopleAligned(prev => [...prev, newPerson]);
    return newPerson;
  };

  const createChildrenForPartnership = (partnershipId: string, variant: 'single' | 'twins' | 'triplets' | 'miscarriage' | 'stillbirth') => {
    const partnership = partnerships.find(p => p.id === partnershipId);
    if (!partnership) return;
    const partner1 = people.find(person => person.id === partnership.partner1_id);
    const partner2 = people.find(person => person.id === partnership.partner2_id);
    if (!partner1 || !partner2) return;

    const anchorX = (partner1.x + partner2.x) / 2;
    const baseY = partnership.horizontalConnectorY + 120;
    let count = 1;
    let baseName = 'Child';
    let lifeStatus: Person['lifeStatus'] | undefined = 'alive';

    switch (variant) {
      case 'twins':
        count = 2;
        baseName = 'Twin';
        break;
      case 'triplets':
        count = 3;
        baseName = 'Triplet';
        break;
      case 'miscarriage':
        baseName = 'Miscarriage';
        lifeStatus = 'miscarriage';
        break;
      case 'stillbirth':
        baseName = 'Stillbirth';
        lifeStatus = 'stillbirth';
        break;
    }

    const spacing = 50;
    const startX = anchorX - ((count - 1) * spacing) / 2;
    const multipleBirthGroupId = count > 1 ? nanoid() : undefined;

    const newChildren: Person[] = Array.from({ length: count }, (_, idx) => ({
      id: nanoid(),
      name: count > 1 ? `${baseName} ${idx + 1}` : baseName,
      x: startX + idx * spacing,
      y: baseY,
      gender: lifeStatus === 'stillbirth' ? (idx % 2 === 0 ? 'female' : 'male') : (idx % 2 === 0 ? 'female' : 'male'),
      partnerships: [],
      parentPartnership: partnershipId,
      connectionAnchorX: multipleBirthGroupId ? anchorX : undefined,
      multipleBirthGroupId,
      lifeStatus,
      events: [],
    }));

    const childIds = newChildren.map(child => child.id);
    setPeopleAligned(prev => [...prev, ...newChildren]);
    setPartnerships(prev =>
      prev.map(p => (p.id === partnershipId ? { ...p, children: [...p.children, ...childIds] } : p))
    );
  };

  const removePartnership = (partnershipId: string) => {
    const partnershipToRemove = partnerships.find(p => p.id === partnershipId);
    if (!partnershipToRemove) return;

    setPartnerships(partnerships.filter(p => p.id !== partnershipId));

    setPeopleAligned(prev =>
      prev.map(p => {
        if (p.id === partnershipToRemove.partner1_id || p.id === partnershipToRemove.partner2_id) {
          return { ...p, partnerships: p.partnerships.filter(pid => pid !== partnershipId) };
        }
        if (partnershipToRemove.children.includes(p.id)) {
          const newP = { ...p };
          delete newP.parentPartnership;
          delete newP.connectionAnchorX;
          return newP;
        }
        return p;
      })
    );
    setContextMenu(null);
  };

  const removePerson = (personId: string) => {
    const personToRemove = people.find(p => p.id === personId);
    if (!personToRemove) return;

    const partnershipsToRemove = partnerships.filter(
      (p) => p.partner1_id === personId || p.partner2_id === personId
    ).map((p) => p.id);

    setPartnerships((prev) =>
      prev
        .filter((p) => p.partner1_id !== personId && p.partner2_id !== personId)
        .map((p) => ({ ...p, children: p.children.filter((id) => id !== personId) }))
    );

    const childrenNeedingCleanup = new Set(partnershipsToRemove);
    setPeople((prev) =>
      alignAllAnchors(
        prev
          .filter((p) => p.id !== personId)
          .map((p) => {
            if (p.parentPartnership && childrenNeedingCleanup.has(p.parentPartnership)) {
              const copy = { ...p };
              delete copy.parentPartnership;
              delete copy.connectionAnchorX;
              return copy;
            }
            return p;
          })
      )
    );

    setEmotionalLines((prev) =>
      prev.filter((line) => line.person1_id !== personId && line.person2_id !== personId)
    );

    if (selectedPeopleIds.includes(personId)) {
      setSelectedPeopleIds(selectedPeopleIds.filter((id) => id !== personId));
    }
    if (propertiesPanelItem?.id === personId) {
      setPropertiesPanelItem(null);
    }
    setContextMenu(null);
  };

  const removeChildFromPartnership = (childId: string, partnershipId: string) => {
    setPartnerships(partnerships.map(p => {
        if (p.id === partnershipId) {
            return { ...p, children: p.children.filter(id => id !== childId) };
        }
        return p;
    }));

    setPeopleAligned(prev =>
      prev.map(p => {
        if (p.id === childId) {
          const newP = { ...p };
          delete newP.parentPartnership;
          delete newP.connectionAnchorX;
          return newP;
        }
        return p;
      })
    );
    setContextMenu(null);
  };

  const handlePersonContextMenu = (e: KonvaEventObject<PointerEvent>, person: Person) => {
      e.evt.preventDefault();
      console.log('selectedPeopleIds:', selectedPeopleIds);
      console.log('selectedPartnershipId:', selectedPartnershipId);
      if (!selectedPeopleIds.includes(person.id) || selectedPeopleIds.length === 0) {
        setSelectedPeopleIds([person.id]);
        setPropertiesPanelItem(person);
      }
      setSelectedPartnershipId(null);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      
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
                addEmotionalLine(p1_id, p2_id, 'fusion', 'low', 'none');
                setContextMenu(null);
                setSelectedPeopleIds([]);
            }
        });
      }

    menuItems.push({
        label: 'Add as Child',
        onClick: () => {
            if (selectedPartnershipId) {
                addChildToPartnership(person.id, selectedPartnershipId);
                setContextMenu(null);
            } else {
                alert('Select a partnership first (click a PRL) before adding this child.');
            }
        }
    });

    menuItems.push({
        label: 'Remove as Child',
        onClick: () => {
            if (person.parentPartnership) {
                removeChildFromPartnership(person.id, person.parentPartnership!); 
                setContextMenu(null);
            } else {
                alert('This person is not currently linked as a child.');
            }
        }
    });

      setContextMenu({
          x: e.evt.clientX,
          y: e.evt.clientY,
          items: [
            ...menuItems,
            {
              label: 'Delete Person',
              onClick: () => removePerson(person.id),
            },
          ],
      });
  };


  const handleChildLineContextMenu = (e: KonvaEventObject<PointerEvent>, childId: string, partnershipId: string) => {
    e.evt.preventDefault();
    setSelectedChildId(childId);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setPropertiesPanelItem(null);
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
            },
            {
                label: 'Delete Child',
                onClick: () => {
                    removeChildFromPartnership(childId, partnershipId);
                    removePerson(childId);
                }
            },
        ]
    });
  };

  const handlePartnershipContextMenu = (e: KonvaEventObject<PointerEvent>, partnershipId: string) => {
    e.evt.preventDefault();
    const partnership = partnerships.find(p => p.id === partnershipId);
    if (!partnership) return;

    setSelectedPartnershipId(partnershipId);
    setSelectedPeopleIds([]);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setPropertiesPanelItem(partnership);

    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: [
            {
                label: 'Add Child',
                onClick: () => {
                    createChildrenForPartnership(partnershipId, 'single');
                    setContextMenu(null);
                }
            },
            {
                label: 'Add Twins',
                onClick: () => {
                    createChildrenForPartnership(partnershipId, 'twins');
                    setContextMenu(null);
                }
            },
            {
                label: 'Add Triplets',
                onClick: () => {
                    createChildrenForPartnership(partnershipId, 'triplets');
                    setContextMenu(null);
                }
            },
            {
                label: 'Add Miscarriage',
                onClick: () => {
                    createChildrenForPartnership(partnershipId, 'miscarriage');
                    setContextMenu(null);
                }
            },
            {
                label: 'Add Stillbirth',
                onClick: () => {
                    createChildrenForPartnership(partnershipId, 'stillbirth');
                    setContextMenu(null);
                }
            },
            {
              label: 'Properties',
              onClick: () => {
                  setPropertiesPanelItem(partnership);
                  setContextMenu(null);
              }
            },
            {
              label: 'Delete Partnership',
              onClick: () => removePartnership(partnershipId)
            },
        ]
    });
  };

  const handleStageContextMenu = (e: KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    if (e.target !== e.target.getStage()) {
        return;
    }
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setPropertiesPanelItem(null);
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;

    const baseItems = [
        {
            label: 'Add Person',
            onClick: () => {
                addPerson(pointerPosition.x, pointerPosition.y);
                setContextMenu(null);
            }
        },
    ];

    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: baseItems
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

      setPeopleAligned((prev) =>
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

    setPeopleAligned((prev) =>
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
    setPeopleAligned((prev) =>
      prev.map((person) =>
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
              label: 'Properties',
              onClick: () => {
                  setPropertiesPanelItem(emotionalLine);
                  setContextMenu(null);
              }
            },
            {
                label: 'Delete Emotional Line',
                onClick: () => removeEmotionalLine(emotionalLineId)
            },
        ]
    });
  };

  const handleSelect = (personId: string, additive: boolean) => {
    const selectedPerson = people.find((person) => person.id === personId);
    if (!selectedPerson) return;

    if (additive) {
      const alreadySelected = selectedPeopleIds.includes(personId);
      const next = alreadySelected
        ? selectedPeopleIds.filter((id) => id !== personId)
        : [...selectedPeopleIds, personId];
      setSelectedPeopleIds(next);
      setSelectedEmotionalLineId(null);
      setSelectedPartnershipId(null);
      setSelectedChildId(null);
      setPropertiesPanelItem(next.length === 1 ? selectedPerson : null);
      return;
    }

    setSelectedEmotionalLineId(null);
    setSelectedPartnershipId(null);
    setSelectedChildId(null);
    setSelectedPeopleIds([personId]);
    setPropertiesPanelItem(selectedPerson);
  };

  const handlePartnershipSelect = (partnershipId: string) => {
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
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

      const canvasWidth = Math.max(0, viewport.width - panelWidth);
      const canvasHeight = Math.max(0, viewport.height - 150);
      const now = Date.now();
      const saveVisualState = getSaveButtonState(isDirty, lastDirtyTimestamp, now);
      const shouldBlinkSave = saveVisualState === 'critical';
      const blinkOn = shouldBlinkSave ? Math.floor(now / 600) % 2 === 0 : false;
      const isSaveDirty = saveVisualState !== 'clean';
      const saveButtonStyle: React.CSSProperties = {
        backgroundColor: isSaveDirty
          ? blinkOn
            ? '#ff5252'
            : '#c62828'
          : '#1976d2',
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        padding: '8px 16px',
        fontWeight: 600,
        boxShadow: isSaveDirty ? '0 0 0 2px rgba(198,40,40,0.35)' : 'none',
        cursor: 'pointer',
      };
      const fileMenuItems = [
        { label: 'New', action: handleNewFile },
        { label: 'Open', action: handleOpenFilePicker },
        { label: 'Save', action: () => handleSave(false) },
        { label: 'Save As', action: handleSaveAs },
        { label: 'Export PNG', action: handleExportPNG },
        { label: 'Export SVG', action: handleExportSVG },
        { label: 'Quit', action: handleQuit },
      ];
      const handleFileMenuAction = (action: () => void) => {
        setFileMenuOpen(false);
        action();
      };

      return (
        <div>
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid #ccc',
              background: '#f6f7fb',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ position: 'relative' }} ref={fileMenuRef}>
              <button
                onClick={() => setFileMenuOpen((prev) => !prev)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: '1px solid #b0b0b0',
                  background: '#fff',
                  cursor: 'pointer',
                }}
                aria-haspopup="menu"
                aria-expanded={fileMenuOpen}
              >
                File ▾
              </button>
              {fileMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: 6,
                    boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                    minWidth: 180,
                    zIndex: 1000,
                  }}
                >
                  {fileMenuItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleFileMenuAction(item.action)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => handleFileMenuAction(() => handleSave(false))} style={saveButtonStyle}>
              Save
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label htmlFor="autosave-minutes" style={{ fontWeight: 500 }}>Auto-Save (min)</label>
              <input
                id="autosave-minutes"
                type="number"
                min={0.25}
                max={180}
                step={0.25}
                value={autoSaveMinutes}
                onChange={(e) => handleAutoSaveMinutesInput(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <span>Zoom</span>
              <input
                type="range"
                min={0.25}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              <span style={{ minWidth: 48, textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
            </label>
            <button onClick={() => setSettingsOpen(true)}>Event Categories</button>
            <button onClick={() => setIndicatorSettingsOpen(true)}>Functional Indicators</button>
            <input
              ref={loadInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleLoad}
            />
          </div>
          <div style={{ display: 'flex' }}>
            {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
            <div style={{ flex: 1, position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  zIndex: 5,
                  lineHeight: 1.3,
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 600 }}>Family Diagram Maker</div>
                <div style={{ fontSize: 14, color: '#333' }}>{fileName || 'Untitled'}</div>
              </div>
              <Stage 
                ref={stageRef}
                width={canvasWidth} 
                height={canvasHeight}
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
                  translateDiagram(dx, dy);
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
                  translateDiagram(dx, dy);
                  panStartRef.current = { x: pointer.x, y: pointer.y };
                }}
                onTouchEnd={() => {
                  setIsPanning(false);
                  panStartRef.current = null;
                }}
                onClick={(e) => {
                  if (e.target === e.target.getStage()) {
                    setSelectedPeopleIds([]);
                    setSelectedPartnershipId(null);
                    setSelectedEmotionalLineId(null);
                    setSelectedChildId(null);
                    setPropertiesPanelItem(null);
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
                      functionalIndicatorDefinitions={functionalIndicatorDefinitions}
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
              {(showMultiPersonPanel || propertiesPanelItem) && (
                showMultiPersonPanel ? (
                  <MultiPersonPropertiesPanel
                    selectedPeople={multiSelectedPeople}
                    onBatchUpdate={handleBatchUpdatePersons}
                    onClose={() => {
                      setSelectedPeopleIds([]);
                      setPropertiesPanelItem(null);
                    }}
                  />
                ) : (
                  propertiesPanelItem && (
                    <PropertiesPanel
                      selectedItem={propertiesPanelItem}
                      people={people}
                      eventCategories={eventCategories}
                      functionalIndicatorDefinitions={functionalIndicatorDefinitions}
                      onUpdatePerson={handleUpdatePerson}
                      onUpdatePartnership={handleUpdatePartnership}
                      onUpdateEmotionalLine={handleUpdateEmotionalLine}
                      onClose={() => setPropertiesPanelItem(null)}
                    />
                  )
                )
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
          {indicatorSettingsOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2050,
              }}
            >
              <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 520, maxHeight: '80vh', overflow: 'auto' }}>
                <h4>Functional Indicators</h4>
                <p style={{ marginTop: 4, color: '#555', fontSize: 13 }}>
                  Add labeled icons that appear beside each person to track affairs, substance use, or any situational flag. If no image is selected, the first letter of the label is used automatically.
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder="Indicator label (e.g., Affair)"
                    value={indicatorDraftLabel}
                    onChange={(e) => setIndicatorDraftLabel(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleIndicatorDraftIconChange(e.target.files?.[0] ?? null)}
                  />
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      border: '1px solid #ddd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#fafafa',
                      fontWeight: 600,
                    }}
                  >
                    {indicatorDraftIcon ? (
                      <img src={indicatorDraftIcon} alt="preview" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                    ) : (
                      (indicatorDraftLabel.trim().charAt(0) || '?').toUpperCase()
                    )}
                  </div>
                  <button onClick={addFunctionalIndicatorDefinition} disabled={!indicatorDraftLabel.trim()}>
                    Add
                  </button>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {functionalIndicatorDefinitions.length === 0 && (
                    <li style={{ fontStyle: 'italic', color: '#777' }}>No indicators defined yet.</li>
                  )}
                  {functionalIndicatorDefinitions.map((definition) => (
                    <li
                      key={definition.id}
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: 8,
                        padding: 10,
                        background: '#fdfdfd',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 8,
                            border: '1px solid #ccc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#fff',
                            flexShrink: 0,
                          }}
                        >
                          {definition.iconDataUrl ? (
                            <img src={definition.iconDataUrl} alt={`${definition.label} icon`} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                          ) : (
                            <span style={{ fontWeight: 600 }}>{(definition.label.trim().charAt(0) || '?').toUpperCase()}</span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={definition.label}
                          onChange={(e) => updateFunctionalIndicatorLabel(definition.id, e.target.value)}
                          style={{ flex: 1 }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <label style={{ fontSize: 13 }}>Icon image:</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              void updateFunctionalIndicatorIcon(definition.id, file);
                            }
                          }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                          <button onClick={() => clearFunctionalIndicatorIcon(definition.id)}>Use Letter</button>
                          <button onClick={() => removeFunctionalIndicatorDefinition(definition.id)} style={{ color: '#b00020' }}>
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button onClick={() => setIndicatorSettingsOpen(false)}>Close</button>
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
