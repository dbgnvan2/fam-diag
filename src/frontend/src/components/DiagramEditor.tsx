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
  const stageRef = useRef<StageType>(null);

  useEffect(() => {
    const savedPeople = localStorage.getItem('genogram-people');
    const savedPartnerships = localStorage.getItem('genogram-partnerships');
    const savedEmotionalLines = localStorage.getItem('genogram-emotional-lines');

    if (savedPeople && savedPartnerships && savedEmotionalLines) {
      setPeople(JSON.parse(savedPeople));
      setPartnerships(JSON.parse(savedPartnerships));
      setEmotionalLines(JSON.parse(savedEmotionalLines));
    }
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
    setEmotionalLines(emotionalLines.map(el => 
        el.id === emotionalLineId ? { ...el, ...updatedProps } : el
    ));
    setPropertiesPanelItem(prev => {
        if (prev && prev.id === emotionalLineId && 'lineStyle' in prev) { // check if it is an emotional line
            return { ...prev, ...updatedProps };
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
                setEmotionalLines(data.emotionalLines);
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
            label: 'Properties',
            onClick: () => {
                setPropertiesPanelItem(person);
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

  const handlePersonDrag = (personId: string, x: number, y: number) => {
    setPeople(
      people.map((person) =>
        person.id === personId ? { ...person, x, y } : person
      )
    );
  };

  const handleHorizontalConnectorDragEnd = (partnershipId: string, y: number) => {
    setPartnerships(
      partnerships.map((p) =>
        p.id === partnershipId ? { ...p, horizontalConnectorY: y } : p
      )
    );
  };



  const handleChildLineSelect = (childId: string) => {
    setSelectedChildId(childId);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
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

  const handleSelect = (personId: string) => {
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
  };

  const handlePartnershipSelect = (partnershipId: string) => {
    setSelectedEmotionalLineId(null);
    if (selectedPartnershipId === partnershipId) {
        setSelectedPartnershipId(null);
    } else {
        setSelectedPartnershipId(partnershipId);
        setSelectedPeopleIds([]);
    }
  };

      return (
        <div>
                <div style={{ padding: 10, borderBottom: '1px solid #ccc' }}>
                  <button onClick={handleSave}>Save</button>
                  <input type="file" id="load-file" style={{ display: 'none' }} onChange={handleLoad} accept=".json" />
                  <label htmlFor="load-file" style={{ cursor: 'pointer', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginLeft: 10 }}>Load</label>
                  <button onClick={handleExportPNG}>Export as PNG</button>
                  <button onClick={handleExportSVG}>Export as SVG</button>
                </div>          <div style={{ display: 'flex' }}>
            {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
            <div style={{ flex: 1 }}>
              <Stage 
                ref={stageRef}
                width={window.innerWidth - 240} 
                height={window.innerHeight - 150}
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
                      onDragMove={(e) => handlePersonDrag(person.id, e.target.x(), e.target.y())}
                      onDragEnd={(e) => handlePersonDrag(person.id, e.target.x(), e.target.y())}
                      onContextMenu={handlePersonContextMenu}
                    />
                  ))}
                </Layer>
              </Stage>
            </div>
            <div style={{ width: 220 }}>
              {propertiesPanelItem && <PropertiesPanel selectedItem={propertiesPanelItem} onUpdatePerson={handleUpdatePerson} onUpdatePartnership={handleUpdatePartnership} onUpdateEmotionalLine={handleUpdateEmotionalLine} onClose={() => setPropertiesPanelItem(null)} />}
            </div>
          </div>
        </div>
      );
    };export default DiagramEditor;
