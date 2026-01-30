import React, { useState } from 'react';
import { Stage, Layer } from 'react-konva';
import type { Person, Partnership } from '../types';
import PersonNode from './PersonNode';
import PartnershipNode from './PartnershipNode';
import ChildConnection from './ChildConnection';
import { nanoid } from 'nanoid';
import ContextMenu from './ContextMenu';
import { KonvaEventObject } from 'konva/lib/Node';

const p1_id = nanoid();
const p2_id = nanoid();
const child_id = nanoid();

const initialPeople: Person[] = [
  { id: p1_id, name: 'John Doe', x: 50, y: 50, gender: 'male', partnerships: ['p1'] },
  { id: p2_id, name: 'Jane Doe', x: 250, y: 50, gender: 'female', partnerships: ['p1'] },
  { id: child_id, name: 'Junior Doe', x: 150, y: 200, gender: 'male', parentPartnership: 'p1', partnerships: [] },
];

const initialPartnerships: Partnership[] = [
    { id: 'p1', partner1_id: p1_id, partner2_id: p2_id, horizontalConnectorY: 150, relationshipType: 'married', children: [child_id] }
];

const DiagramEditor = () => {
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [partnerships, setPartnerships] = useState<Partnership[]>(initialPartnerships);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [selectedPartnershipId, setSelectedPartnershipId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: any[] } | null>(null);

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
        relationshipType: 'partnered',
        children: [],
    };
    setPartnerships([...partnerships, newPartnership]);
    setSelectedPeopleIds([]);
    setContextMenu(null);
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
    setContextMenu(null);
  }

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



        



        const menuItems = [



            {



                label: `Change sex to ${person.gender === 'male' ? 'female' : 'male'} `,



                onClick: () => {



                    changeSex(person.id);



                    setContextMenu(null);



                }



            }



        ];



        



        if (selectedPeopleIds.includes(person.id)) {



          if (selectedPeopleIds.length === 2) {



              menuItems.push({ label: 'Add Partnership', onClick: addPartnership });



          }



          if (selectedPeopleIds.length === 1 && selectedPartnershipId) {



               menuItems.push({ label: 'Add as Child', onClick: addChildToPartnership });



          }



      }



  



      if (person.parentPartnership) {



          menuItems.push({



              label: 'Remove as Child',



              onClick: () => {



                  removeChildFromPartnership(person.id, person.parentPartnership!);



              }



          });



      }



  



        setContextMenu({



            x: e.evt.clientX,



            y: e.evt.clientY,



            items: menuItems,



        });



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

  const handlePartnershipContextMenu = (e: KonvaEventObject<PointerEvent>, partnershipId: string) => {
    e.evt.preventDefault();
    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: [
            {
                label: 'Remove Partnership',
                onClick: () => removePartnership(partnershipId)
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

  const handleSelect = (personId: string) => {
    if (selectedPeopleIds.includes(personId)) {
        setSelectedPeopleIds(selectedPeopleIds.filter(id => id !== personId));
        return;
    }

    if (selectedPartnershipId) {
        setSelectedPartnershipId(null);
        setSelectedPeopleIds([personId]);
        return;
    }

    if (selectedPeopleIds.length < 2) {
        setSelectedPeopleIds([...selectedPeopleIds, personId]);
    }
  };

  const handlePartnershipSelect = (partnershipId: string) => {
    if (selectedPartnershipId === partnershipId) {
        setSelectedPartnershipId(null);
        return;
    }
    
    if (selectedPeopleIds.length > 1) {
        setSelectedPeopleIds([]);
    }
    setSelectedPartnershipId(partnershipId);
  };

  return (
    <div>
      {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
      <Stage 
        width={window.innerWidth - 20} 
        height={window.innerHeight - 100}
        onClick={(e) => {
          if (e.target === e.target.getStage()) {
            setSelectedPeopleIds([]);
            setSelectedPartnershipId(null);
          }
        }}
        onContextMenu={handleStageContextMenu}
      >
        <Layer>
          {/* Render Connections */}
          {partnerships.map((p) => {
              const partner1 = people.find(person => person.id === p.partner1_id);
              const partner2 = people.find(person => person.id === p.partner2_id);
              if (!partner1 || !partner2) return null;

              const childConnections = p.children.map(childId => {
                  const child = people.find(c => c.id === childId);
                  if (!child) return null;
                  return <ChildConnection key={`child-conn-${childId}`} child={child} partnership={p} partner1={partner1} partner2={partner2} />
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
  );
};

export default DiagramEditor;
