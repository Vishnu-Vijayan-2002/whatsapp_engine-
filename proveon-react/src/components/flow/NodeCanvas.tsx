import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { FlowNode, FlowEdge, FlowNodeType, WhatsAppNodeFlow } from '../../types';
import './NodeCanvas.css';

interface NodeCanvasProps {
  flow: WhatsAppNodeFlow;
  onChange: (updatedFlow: WhatsAppNodeFlow) => void;
  onSelectNode?: (node: FlowNode | null) => void;
}

let canvasIdSeq = 1000;
const nextCanvasId = (prefix: string) => `${prefix}-${++canvasIdSeq}`;

export const NodeCanvas: React.FC<NodeCanvasProps> = ({ flow, onChange, onSelectNode }) => {
  const [zoom, setZoom] = useState<number>(0.9);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 30, y: 30 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Dragging node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; nodeX: number; nodeY: number }>({
    mouseX: 0,
    mouseY: 0,
    nodeX: 0,
    nodeY: 0,
  });

  // Panning canvas state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number }>({
    mouseX: 0,
    mouseY: 0,
    panX: 0,
    panY: 0,
  });

  // Connecting edge state
  const [connectingSource, setConnectingSource] = useState<{ nodeId: string; handle: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom helpers
  const handleZoomIn = () => setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))));
  const handleResetZoom = () => {
    setZoom(0.85);
    setPan({ x: 40, y: 40 });
  };

  // Node selection
  const handleSelectNode = (node: FlowNode, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedNodeId(node.id);
    if (onSelectNode) onSelectNode(node);
  };

  // Start dragging a node
  const handleNodeHeaderMouseDown = (node: FlowNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setDraggingNodeId(node.id);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
  };

  // Start panning canvas
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.flow-node-card') || (e.target as HTMLElement).closest('.flow-palette-bar') || (e.target as HTMLElement).closest('.flow-canvas-controls')) {
      return;
    }
    setIsPanning(true);
    panStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setSelectedNodeId(null);
    setConnectingSource(null);
    if (onSelectNode) onSelectNode(null);
  };

  // Global mouse move and up for drag & pan
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggingNodeId) {
        const dx = (e.clientX - dragStartRef.current.mouseX) / zoom;
        const dy = (e.clientY - dragStartRef.current.mouseY) / zoom;
        const newX = Math.round(dragStartRef.current.nodeX + dx);
        const newY = Math.round(dragStartRef.current.nodeY + dy);

        const updatedNodes = flow.nodes.map((n) =>
          n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n
        );
        onChange({ ...flow, nodes: updatedNodes });
      } else if (isPanning) {
        const dx = e.clientX - panStartRef.current.mouseX;
        const dy = e.clientY - panStartRef.current.mouseY;
        setPan({
          x: Math.round(panStartRef.current.panX + dx),
          y: Math.round(panStartRef.current.panY + dy),
        });
      }
    },
    [draggingNodeId, isPanning, zoom, flow, onChange]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingNodeId(null);
    setIsPanning(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Connect / Disconnect handles
  const handlePortClick = (nodeId: string, handle: string, isInput: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInput) {
      if (connectingSource && connectingSource.nodeId !== nodeId) {
        // Create new edge
        const newEdge: FlowEdge = {
          id: nextCanvasId(`edge-${connectingSource.nodeId}-${nodeId}`),
          sourceNodeId: connectingSource.nodeId,
          targetNodeId: nodeId,
          sourceHandle: connectingSource.handle,
          label: connectingSource.handle === 'true' ? 'True' : connectingSource.handle === 'false' ? 'False' : undefined,
        };
        // Remove duplicate edges from same source port if not condition
        const filtered = flow.edges.filter(
          (edge) => !(edge.sourceNodeId === connectingSource.nodeId && edge.sourceHandle === connectingSource.handle)
        );
        onChange({ ...flow, edges: [...filtered, newEdge] });
        setConnectingSource(null);
      }
    } else {
      // Output port clicked: begin connection
      setConnectingSource({ nodeId, handle });
    }
  };

  const handleDeleteEdge = (edgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = flow.edges.filter((e) => e.id !== edgeId);
    onChange({ ...flow, edges: updated });
  };

  const handleDeleteNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedNodes = flow.nodes.filter((n) => n.id !== nodeId);
    const updatedEdges = flow.edges.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId);
    onChange({ ...flow, nodes: updatedNodes, edges: updatedEdges });
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  // Add Node from palette
  const handleAddNode = (type: FlowNodeType) => {
    const id = nextCanvasId('node');
    const selectedNode = selectedNodeId ? flow.nodes.find((n) => n.id === selectedNodeId) : null;

    // Smart positioning: if a node is currently selected, place to the right of it; else default in viewport
    let x: number;
    let y: number;
    if (selectedNode) {
      x = selectedNode.x + 350;
      y = selectedNode.y;
    } else {
      x = Math.round(-pan.x / zoom + 280 + Math.random() * 40);
      y = Math.round(-pan.y / zoom + 180 + Math.random() * 40);
    }

    let defaultTitle = 'New Node';
    let defaultData: any = {};

    switch (type) {
      case 'TRIGGER':
        defaultTitle = 'Customer Trigger';
        defaultData = { keywords: ['appointment', 'consult'], matchType: 'CONTAINS' };
        break;
      case 'MESSAGE':
        defaultTitle = 'Send WhatsApp Message';
        defaultData = { header: 'Important Update', body: 'Hello! Thank you for getting in touch.' };
        break;
      case 'USER_INPUT':
        defaultTitle = 'Capture In-Chat Field';
        defaultData = {
          prompt: 'Please enter your preferred appointment time:',
          variableName: `input_${id.slice(-4)}`,
          inputType: 'text',
          required: true,
        };
        break;
      case 'CONDITION':
        defaultTitle = 'Conditional Rule Check';
        defaultData = { variableName: 'selected_service', operator: 'CONTAINS', compareValue: 'Consultation' };
        break;
      case 'BACKEND_ACTION':
        defaultTitle = 'Backend Rule Action';
        defaultData = { actionType: 'CREATE_APPOINTMENT', description: 'Auto-create Confirmed Appointment in Database', autoConfirm: true, creditCost: 0.50 };
        break;
      case 'TERMINAL':
        defaultTitle = 'Booking Confirmed';
        defaultData = { body: '🎉 All set! Your visit is confirmed in our database. See you soon!', includeSummary: true };
        break;
      case 'SUPPORT_HELPDESK':
        defaultTitle = 'Customer Support & Helpdesk';
        defaultData = {
          header: 'How can our support team assist you today?',
          phone: '+1 (555) 019-2831',
          address: '1200 Innovation Way, Suite 400',
          workingHours: 'Mon-Sat: 9:00 AM - 7:00 PM',
          mapsUrl: 'https://maps.google.com/?q=1200+Innovation+Way',
          options: [
            'Direct Call / Live Agent',
            'Location & Working Hours',
            'Frequently Asked Questions (FAQ)',
            'Leave a Message',
          ],
          faqs: [
            { question: 'What are your accepted payment methods?', answer: 'We accept all major credit cards, Apple Pay, Google Pay, and UPI.' },
            { question: 'What is your cancellation policy?', answer: 'Cancellations or reschedules made 24+ hours in advance incur no fee.' },
            { question: 'Do you offer introductory consultations?', answer: 'Yes! Free 15-minute consultations can be scheduled directly here.' },
          ],
          variableName: 'support_action',
        };
        break;
    }

    const newNode: FlowNode = {
      id,
      type,
      title: defaultTitle,
      x,
      y,
      data: defaultData,
    };

    // Auto-connect if an existing non-terminal node was selected and the new node is not a Trigger
    const newEdges = [...flow.edges];
    if (selectedNode && selectedNode.type !== 'TERMINAL' && type !== 'TRIGGER') {
      if (selectedNode.type === 'CONDITION') {
        const hasTrue = newEdges.some((e) => e.sourceNodeId === selectedNode.id && e.sourceHandle === 'true');
        const hasFalse = newEdges.some((e) => e.sourceNodeId === selectedNode.id && e.sourceHandle === 'false');
        if (!hasTrue) {
          newEdges.push({
            id: nextCanvasId(`edge-${selectedNode.id}-${id}`),
            sourceNodeId: selectedNode.id,
            targetNodeId: id,
            sourceHandle: 'true',
            label: 'True',
          });
        } else if (!hasFalse) {
          newEdges.push({
            id: nextCanvasId(`edge-${selectedNode.id}-${id}`),
            sourceNodeId: selectedNode.id,
            targetNodeId: id,
            sourceHandle: 'false',
            label: 'False',
          });
        }
      } else {
        // Standard single output: replace any existing edge or append
        const filteredEdges = newEdges.filter((e) => e.sourceNodeId !== selectedNode.id);
        filteredEdges.push({
          id: nextCanvasId(`edge-${selectedNode.id}-${id}`),
          sourceNodeId: selectedNode.id,
          targetNodeId: id,
          sourceHandle: 'default',
        });
        newEdges.length = 0;
        newEdges.push(...filteredEdges);
      }
    }

    onChange({
      ...flow,
      nodes: [...flow.nodes, newNode],
      edges: newEdges,
    });
    setSelectedNodeId(id);
  };

  // Dropdown connector helper
  const handleDropdownConnect = (sourceNodeId: string, targetNodeId: string, sourceHandle: string = 'default') => {
    if (!targetNodeId || targetNodeId === 'none') {
      // Remove connection
      const updatedEdges = flow.edges.filter(
        (e) => !(e.sourceNodeId === sourceNodeId && (sourceHandle === 'default' ? !e.sourceHandle || e.sourceHandle === 'default' : e.sourceHandle === sourceHandle))
      );
      onChange({ ...flow, edges: updatedEdges });
      return;
    }

    // Filter out existing edge from this handle
    const remainingEdges = flow.edges.filter(
      (e) => !(e.sourceNodeId === sourceNodeId && (sourceHandle === 'default' ? !e.sourceHandle || e.sourceHandle === 'default' : e.sourceHandle === sourceHandle))
    );

    const newEdge: FlowEdge = {
      id: nextCanvasId(`edge-${sourceNodeId}-${targetNodeId}`),
      sourceNodeId,
      targetNodeId,
      sourceHandle,
      label: sourceHandle === 'true' ? 'True' : sourceHandle === 'false' ? 'False' : undefined,
    };

    onChange({ ...flow, edges: [...remainingEdges, newEdge] });
  };

  // Node editing helper
  const handleUpdateNodeData = (nodeId: string, updates: any) => {
    const updatedNodes = flow.nodes.map((n) => {
      if (n.id === nodeId) {
        return {
          ...n,
          data: { ...n.data, ...updates },
        };
      }
      return n;
    });
    onChange({ ...flow, nodes: updatedNodes });
  };

  // Option item addition
  const handleAddOption = (nodeId: string) => {
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const currentOptions: string[] = Array.isArray((node.data as any)?.options)
      ? [...(node.data as any).options]
      : [];
    const newOpt = `Option ${currentOptions.length + 1}`;
    const updatedOptions = [...currentOptions, newOpt];

    const updatedNodes = flow.nodes.map((n) => {
      if (n.id === nodeId) {
        return {
          ...n,
          data: { ...n.data, options: updatedOptions },
        };
      }
      return n;
    });

    onChange({ ...flow, nodes: updatedNodes });
  };

  // Option item deletion + edge cleanup
  const handleDeleteOption = (nodeId: string, optIndex: number, optValue: string) => {
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const currentOptions: string[] = Array.isArray((node.data as any)?.options)
      ? [...(node.data as any).options]
      : [];
    const updatedOptions = currentOptions.filter((_, i) => i !== optIndex);

    // If node also has services, keep them in sync
    const currentServices: any[] = Array.isArray((node.data as any)?.services)
      ? [...(node.data as any).services]
      : [];
    const updatedServices = currentServices.filter((s) => s.name !== optValue);

    // Remove any connected edges from this option port
    const filteredEdges = flow.edges.filter(
      (e) => !(e.sourceNodeId === nodeId && (e.sourceHandle === optValue || e.label === optValue))
    );

    const updatedNodes = flow.nodes.map((n) => {
      if (n.id === nodeId) {
        return {
          ...n,
          data: {
            ...n.data,
            options: updatedOptions,
            ...(currentServices.length > 0 ? { services: updatedServices } : {}),
          },
        };
      }
      return n;
    });

    onChange({ ...flow, nodes: updatedNodes, edges: filteredEdges });
  };

  // Option item rename + edge updates
  const handleUpdateOption = (nodeId: string, optIndex: number, newValue: string) => {
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const currentOptions: string[] = Array.isArray((node.data as any)?.options)
      ? [...(node.data as any).options]
      : [];
    const oldOpt = currentOptions[optIndex];
    currentOptions[optIndex] = newValue;

    // Synchronize matching service name if any
    const currentServices: any[] = Array.isArray((node.data as any)?.services)
      ? [...(node.data as any).services]
      : [];
    const updatedServices = currentServices.map((s) => (s.name === oldOpt ? { ...s, name: newValue } : s));

    // Update any connected edge label & handle
    let updatedEdges = flow.edges;
    if (oldOpt && newValue && oldOpt !== newValue) {
      updatedEdges = flow.edges.map((e) => {
        if (e.sourceNodeId === nodeId && (e.sourceHandle === oldOpt || e.label === oldOpt)) {
          return { ...e, sourceHandle: newValue, label: newValue };
        }
        return e;
      });
    }

    const updatedNodes = flow.nodes.map((n) => {
      if (n.id === nodeId) {
        return {
          ...n,
          data: {
            ...n.data,
            options: currentOptions,
            ...(currentServices.length > 0 ? { services: updatedServices } : {}),
          },
        };
      }
      return n;
    });

    onChange({ ...flow, nodes: updatedNodes, edges: updatedEdges });
  };

  // Add a dynamic step/branch to "Next Step / Connect to"
  const handleAddStep = (nodeId: string) => {
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const currentOptions: string[] = Array.isArray((node.data as any)?.options)
      ? [...(node.data as any).options]
      : [];

    let updatedOptions: string[];
    let updatedEdges = [...flow.edges];

    if (currentOptions.length === 0) {
      // Transitioning from 1 default step to 2 dynamic steps
      const existingDefaultEdge = flow.edges.find(
        (e) => e.sourceNodeId === nodeId && (!e.sourceHandle || e.sourceHandle === 'default')
      );
      updatedOptions = ['Option 1', 'Option 2'];
      if (existingDefaultEdge) {
        updatedEdges = updatedEdges.map((e) =>
          e.id === existingDefaultEdge.id
            ? { ...e, sourceHandle: 'Option 1', label: 'Option 1' }
            : e
        );
      }
    } else {
      const nextNum = currentOptions.length + 1;
      updatedOptions = [...currentOptions, `Option ${nextNum}`];
    }

    const updatedNodes = flow.nodes.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            data: {
              ...n.data,
              options: updatedOptions,
            },
          }
        : n
    );

    onChange({ ...flow, nodes: updatedNodes, edges: updatedEdges });
  };

  // Remove a dynamic step/branch from "Next Step / Connect to" (e.g. remove 1 if there are 3)
  const handleRemoveStep = (nodeId: string, index: number, handle: string) => {
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const currentOptions: string[] = Array.isArray((node.data as any)?.options)
      ? [...(node.data as any).options]
      : [];

    let updatedOptions: string[] = [];
    let updatedEdges = flow.edges.filter(
      (e) => !(e.sourceNodeId === nodeId && (e.sourceHandle === handle || e.label === handle || (!e.sourceHandle && handle === 'default')))
    );

    if (currentOptions.length > 2) {
      // E.g. had 3, now 2
      updatedOptions = currentOptions.filter((_, i) => i !== index);
    } else if (currentOptions.length === 2) {
      // Had 2, removing 1 leaves 1 single step
      const remainingOption = currentOptions.filter((_, i) => i !== index)[0];
      updatedOptions = [remainingOption];
    } else if (currentOptions.length === 1) {
      // Reset back to empty default
      updatedOptions = [];
    }

    const updatedNodes = flow.nodes.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            data: {
              ...n.data,
              options: updatedOptions,
            },
          }
        : n
    );

    onChange({ ...flow, nodes: updatedNodes, edges: updatedEdges });
  };

  // Update a dynamic step/branch label
  const handleUpdateStepLabel = (nodeId: string, index: number, oldLabel: string, newLabel: string) => {
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const currentOptions: string[] = Array.isArray((node.data as any)?.options)
      ? [...(node.data as any).options]
      : [];

    currentOptions[index] = newLabel;

    let updatedEdges = flow.edges;
    if (oldLabel && newLabel && oldLabel !== newLabel) {
      updatedEdges = flow.edges.map((e) => {
        if (e.sourceNodeId === nodeId && (e.sourceHandle === oldLabel || e.label === oldLabel)) {
          return { ...e, sourceHandle: newLabel, label: newLabel };
        }
        return e;
      });
    }

    const updatedNodes = flow.nodes.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            data: {
              ...n.data,
              options: currentOptions,
            },
          }
        : n
    );

    onChange({ ...flow, nodes: updatedNodes, edges: updatedEdges });
  };

  // Compute Port coordinates for Bezier Curves
  const getNodePortCoord = (nodeId: string, handle: string = 'default', isInput: boolean) => {
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const nodeWidth = 290;
    if (isInput) {
      return { x: node.x, y: node.y + 70 };
    } else {
      if (node.type === 'CONDITION') {
        if (handle === 'true') {
          return { x: node.x + nodeWidth, y: node.y + 44 };
        } else {
          return { x: node.x + nodeWidth, y: node.y + 92 };
        }
      }
      const nodeOptions = (node.data as any)?.options;
      if (nodeOptions && Array.isArray(nodeOptions) && nodeOptions.length > 1 && handle !== 'default') {
        const optIndex = nodeOptions.indexOf(handle);
        if (optIndex !== -1) {
          return { x: node.x + nodeWidth, y: node.y + 48 + optIndex * 36 };
        }
      }
      return { x: node.x + nodeWidth, y: node.y + 70 };
    }
  };

  return (
    <div
      ref={containerRef}
      className="flow-canvas-container"
      onMouseDown={handleCanvasMouseDown}
    >
      {/* Node Palette Bar */}
      <div className="flow-palette-bar">
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginRight: '4px' }}>
          + Add Node:
        </span>
        <button type="button" className="palette-btn trigger" onClick={() => handleAddNode('TRIGGER')} title="Add Keyword Trigger">
          🎯 Trigger
        </button>
        <button type="button" className="palette-btn message" onClick={() => handleAddNode('MESSAGE')} title="Add WhatsApp Message">
          💬 Message
        </button>
        <button type="button" className="palette-btn input" onClick={() => handleAddNode('USER_INPUT')} title="Capture Direct Input Field in WhatsApp">
          📝 Input Field
        </button>
        <button type="button" className="palette-btn condition" onClick={() => handleAddNode('CONDITION')} title="Add Conditional Logic Rule">
          🔀 Condition
        </button>
        <button type="button" className="palette-btn action" onClick={() => handleAddNode('BACKEND_ACTION')} title="Add Backend Database Mutation / Rule Action">
          ⚡ Rule Action
        </button>
        <button type="button" className="palette-btn support" onClick={() => handleAddNode('SUPPORT_HELPDESK')} title="Add Customer Support & Helpdesk Node">
          🎧 Support
        </button>
        <button type="button" className="palette-btn terminal" onClick={() => handleAddNode('TERMINAL')} title="Add Final Confirmation Receipt">
          🏁 Completion
        </button>
      </div>

      {/* Floating Canvas Controls */}
      <div className="flow-canvas-controls">
        <button type="button" className="canvas-control-btn" onClick={handleZoomIn} title="Zoom In">
          +
        </button>
        <span style={{ fontSize: '11px', fontWeight: 700, padding: '0 4px', color: 'var(--text-secondary)' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" className="canvas-control-btn" onClick={handleZoomOut} title="Zoom Out">
          -
        </button>
        <button type="button" className="canvas-control-btn" onClick={handleResetZoom} title="Reset View" style={{ fontSize: '12px' }}>
          ↺
        </button>
      </div>

      {/* Visual Connecting Active Banner */}
      {connectingSource && (
        <div className="connecting-banner-pill">
          <span>
            🔗 Connecting from <strong>{flow.nodes.find((n) => n.id === connectingSource.nodeId)?.title || 'Node'}</strong>
            {connectingSource.handle === 'true' ? ' (True branch)' : connectingSource.handle === 'false' ? ' (False branch)' : ''} ➔ Click any pulsing blue circle to connect
          </span>
          <button
            type="button"
            className="connecting-cancel-btn"
            onClick={() => setConnectingSource(null)}
          >
            Cancel ✕
          </button>
        </div>
      )}

      {/* Viewport Transform Layer */}
      <div
        className={`flow-canvas-viewport ${isPanning ? 'panning' : ''}`}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* SVG Bezier Edges Layer */}
        <svg className="flow-svg-layer" width="5000" height="5000">
          <defs>
            <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#3B82F6" />
            </marker>
            <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
            </marker>
            <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
            </marker>
          </defs>

          {flow.edges.map((edge) => {
            const start = getNodePortCoord(edge.sourceNodeId, edge.sourceHandle, false);
            const end = getNodePortCoord(edge.targetNodeId, 'default', true);

            const dx = Math.abs(end.x - start.x) * 0.5;
            const pathData = `M ${start.x} ${start.y} C ${start.x + Math.max(dx, 40)} ${start.y}, ${end.x - Math.max(dx, 40)} ${end.y}, ${end.x} ${end.y}`;

            const isTrue = edge.sourceHandle === 'true';
            const isFalse = edge.sourceHandle === 'false';
            const markerId = isTrue ? 'url(#arrow-green)' : isFalse ? 'url(#arrow-red)' : 'url(#arrow-blue)';

            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;

            return (
              <g key={edge.id}>
                <path
                  d={pathData}
                  className={`flow-edge-path ${isTrue ? 'true-branch' : isFalse ? 'false-branch' : ''}`}
                  markerEnd={markerId}
                  onClick={(e) => handleDeleteEdge(edge.id, e)}
                />
                {edge.label && (
                  <text
                    x={midX}
                    y={midY - 8}
                    fill={isTrue ? '#10B981' : isFalse ? '#EF4444' : 'var(--text-secondary)'}
                    fontSize="11"
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes Layer */}
        {flow.nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isTrigger = node.type === 'TRIGGER';
          const isCondition = node.type === 'CONDITION';
          const isTerminal = node.type === 'TERMINAL';
          const data = node.data as any;
          const nodeOptions: string[] = Array.isArray(data.options) ? data.options : [];
          const branchItems = nodeOptions.length > 0
            ? nodeOptions.map((opt: string, i: number) => ({
                index: i,
                handle: opt,
                label: opt,
                edge: flow.edges.find((e) => e.sourceNodeId === node.id && (e.sourceHandle === opt || e.label === opt)),
              }))
            : [
                {
                  index: 0,
                  handle: 'default',
                  label: 'Default Step',
                  edge: flow.edges.find((e) => e.sourceNodeId === node.id && (!e.sourceHandle || e.sourceHandle === 'default')),
                },
              ];

          return (
            <div
              key={node.id}
              className={`flow-node-card type-${node.type} ${isSelected ? 'selected' : ''}`}
              style={{ left: `${node.x}px`, top: `${node.y}px` }}
              onClick={(e) => handleSelectNode(node, e)}
            >
              {/* Left Input Port Handle (unless trigger) */}
              {!isTrigger && (
                <div
                  className={`node-port-handle input ${connectingSource && connectingSource.nodeId !== node.id ? 'target-candidate' : ''}`}
                  title="Connect from another node"
                  onClick={(e) => handlePortClick(node.id, 'default', true, e)}
                />
              )}

              {/* Node Header (Drag Handle) */}
              <div
                className="node-header"
                onMouseDown={(e) => handleNodeHeaderMouseDown(node, e)}
              >
                <div className="node-title-group">
                  <span>
                    {node.type === 'TRIGGER' && '🎯'}
                    {node.type === 'MESSAGE' && '💬'}
                    {node.type === 'USER_INPUT' && '📝'}
                    {node.type === 'CONDITION' && '🔀'}
                    {node.type === 'BACKEND_ACTION' && '⚡'}
                    {node.type === 'SUPPORT_HELPDESK' && '🎧'}
                    {node.type === 'TERMINAL' && '🏁'}
                  </span>
                  <span>{node.title}</span>
                </div>

                <div className="node-actions-right">
                  <button
                    type="button"
                    className="node-action-icon-btn"
                    title="Delete Node"
                    onClick={(e) => handleDeleteNode(node.id, e)}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Node Body with In-Node Controls */}
              <div className="node-body">
                {/* 1. TRIGGER NODE */}
                {node.type === 'TRIGGER' && (
                  <div>
                    <span className="node-field-label">Trigger Keywords</span>
                    <input
                      type="text"
                      className="node-input-sm"
                      placeholder="comma-separated keywords"
                      value={(data.keywords || []).join(', ')}
                      onChange={(e) =>
                        handleUpdateNodeData(node.id, {
                          keywords: e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
                        })
                      }
                    />
                    <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(data.keywords || []).map((k: string) => (
                        <span key={k} className="node-tag-pill">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. MESSAGE NODE */}
                {node.type === 'MESSAGE' && (
                  <div>
                    <span className="node-field-label">Header (Optional)</span>
                    <input
                      type="text"
                      className="node-input-sm"
                      style={{ marginBottom: '6px' }}
                      value={data.header || ''}
                      placeholder="Header title"
                      onChange={(e) => handleUpdateNodeData(node.id, { header: e.target.value })}
                    />
                    <span className="node-field-label">Message Body</span>
                    <textarea
                      className="node-input-sm"
                      rows={2}
                      value={data.body || ''}
                      placeholder="Message text sent to customer..."
                      onChange={(e) => handleUpdateNodeData(node.id, { body: e.target.value })}
                    />
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="node-field-label" style={{ margin: 0 }}>
                          Interactive Buttons / Branches ({(Array.isArray(data.options) ? data.options : []).length})
                        </span>
                        <button
                          type="button"
                          className="node-add-subitem-btn"
                          onClick={() => handleAddOption(node.id)}
                          title="Add button branch"
                        >
                          + Add Button
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {(Array.isArray(data.options) ? data.options : []).map((opt: string, idx: number) => (
                          <div key={idx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="node-input-sm"
                              style={{ flex: 1 }}
                              value={opt}
                              placeholder={`Button ${idx + 1}`}
                              onChange={(e) => handleUpdateOption(node.id, idx, e.target.value)}
                            />
                            <button
                              type="button"
                              className="node-del-subitem-btn"
                              title={`Delete "${opt}"`}
                              onClick={() => handleDeleteOption(node.id, idx, opt)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. USER INPUT NODE (In-WhatsApp Data Capture Without Redirects) */}
                {node.type === 'USER_INPUT' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="node-field-label" style={{ margin: 0 }}>Target Variable</span>
                      <span className="node-variable-badge">{`{{${data.variableName || 'var'}}}`}</span>
                    </div>
                    <input
                      type="text"
                      className="node-input-sm"
                      style={{ marginBottom: '6px', fontFamily: 'monospace' }}
                      value={data.variableName || ''}
                      placeholder="e.g. customer_name"
                      onChange={(e) => handleUpdateNodeData(node.id, { variableName: e.target.value })}
                    />

                    <span className="node-field-label">WhatsApp In-Chat Prompt</span>
                    <textarea
                      className="node-input-sm"
                      rows={2}
                      style={{ marginBottom: '6px' }}
                      value={data.prompt || ''}
                      placeholder="e.g. Please reply with your full name:"
                      onChange={(e) => handleUpdateNodeData(node.id, { prompt: e.target.value })}
                    />

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <span className="node-field-label">Input Format</span>
                        <select
                          className="node-input-sm"
                          value={data.inputType || 'text'}
                          onChange={(e) => handleUpdateNodeData(node.id, { inputType: e.target.value })}
                        >
                          <option value="text">Text Response</option>
                          <option value="choice">Quick Choices (Buttons)</option>
                          <option value="phone">Phone Number</option>
                          <option value="date">Date & Time</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. CONDITION NODE */}
                {node.type === 'CONDITION' && (
                  <div>
                    <span className="node-field-label">Evaluate Variable</span>
                    <input
                      type="text"
                      className="node-input-sm"
                      style={{ marginBottom: '6px', fontFamily: 'monospace' }}
                      value={data.variableName || ''}
                      placeholder="e.g. service_name"
                      onChange={(e) => handleUpdateNodeData(node.id, { variableName: e.target.value })}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div>
                        <span className="node-field-label">Operator</span>
                        <select
                          className="node-input-sm"
                          value={data.operator || 'CONTAINS'}
                          onChange={(e) => handleUpdateNodeData(node.id, { operator: e.target.value })}
                        >
                          <option value="CONTAINS">Contains</option>
                          <option value="EQUALS">Equals</option>
                          <option value="NOT_EQUALS">Not Equals</option>
                          <option value="IS_EMPTY">Is Empty</option>
                        </select>
                      </div>
                      <div>
                        <span className="node-field-label">Compare Value</span>
                        <input
                          type="text"
                          className="node-input-sm"
                          value={data.compareValue || ''}
                          placeholder="Laser"
                          onChange={(e) => handleUpdateNodeData(node.id, { compareValue: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. BACKEND RULE ACTION NODE */}
                {node.type === 'BACKEND_ACTION' && (
                  <div>
                    <span className="node-field-label">Backend Rule Engine Action</span>
                    <select
                      className="node-input-sm"
                      style={{ marginBottom: '6px' }}
                      value={data.actionType || 'CREATE_APPOINTMENT'}
                      onChange={(e) => handleUpdateNodeData(node.id, { actionType: e.target.value })}
                    >
                      <option value="CREATE_APPOINTMENT">⚡ Auto-Create Appointment in DB</option>
                      <option value="SAVE_CUSTOMER">👤 Save Customer to Directory</option>
                      <option value="NOTIFY_STAFF">🔔 Trigger Staff Alert</option>
                    </select>

                    <div style={{ background: 'var(--bg-input)', padding: '6px 8px', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Meters 0.50 credits and updates live balance in real time.
                    </div>
                  </div>
                )}

                {/* 6. TERMINAL NODE */}
                {node.type === 'TERMINAL' && (
                  <div>
                    <span className="node-field-label">Confirmation Receipt Text</span>
                    <textarea
                      className="node-input-sm"
                      rows={2}
                      value={data.body || ''}
                      placeholder="🎉 Appointment confirmed for {{customer_name}}..."
                      onChange={(e) => handleUpdateNodeData(node.id, { body: e.target.value })}
                    />
                    <div style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <span className="node-field-label" style={{ color: '#2563EB', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                        ⚡ Completion Action: Chain Next Flow
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Start Keyword</span>
                          <input
                            className="node-input-sm"
                            type="text"
                            value={data.chainedFlowTrigger || ''}
                            placeholder="e.g. review"
                            onChange={(e) => handleUpdateNodeData(node.id, { chainedFlowTrigger: e.target.value })}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Target Flow Name</span>
                          <input
                            className="node-input-sm"
                            type="text"
                            value={data.chainedFlowName || ''}
                            placeholder="Rating Triage Flow"
                            onChange={(e) => handleUpdateNodeData(node.id, { chainedFlowName: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. CUSTOMER SUPPORT & HELPDESK NODE */}
                {node.type === 'SUPPORT_HELPDESK' && (
                  <div>
                    <span className="node-field-label">Header Message (Customizable)</span>
                    <textarea
                      className="node-input-sm"
                      rows={2}
                      value={data.header || ''}
                      placeholder="e.g. How can our support team assist you today?"
                      onChange={(e) => handleUpdateNodeData(node.id, { header: e.target.value })}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
                      <div>
                        <span className="node-field-label">Direct Call / Phone</span>
                        <input
                          type="text"
                          className="node-input-sm"
                          value={data.phone || ''}
                          placeholder="+1 (555) 019-2831"
                          onChange={(e) => handleUpdateNodeData(node.id, { phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <span className="node-field-label">Working Hours</span>
                        <input
                          type="text"
                          className="node-input-sm"
                          value={data.workingHours || ''}
                          placeholder="Mon-Sat: 9AM - 7PM"
                          onChange={(e) => handleUpdateNodeData(node.id, { workingHours: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '6px' }}>
                      <span className="node-field-label">Store / Office Address</span>
                      <input
                        type="text"
                        className="node-input-sm"
                        value={data.address || ''}
                        placeholder="1200 Innovation Way, Suite 400"
                        onChange={(e) => handleUpdateNodeData(node.id, { address: e.target.value })}
                      />
                    </div>

                    <div style={{ marginTop: '6px' }}>
                      <span className="node-field-label">Google Maps Pin Link</span>
                      <input
                        type="text"
                        className="node-input-sm"
                        value={data.mapsUrl || ''}
                        placeholder="https://maps.google.com/?q=..."
                        onChange={(e) => handleUpdateNodeData(node.id, { mapsUrl: e.target.value })}
                      />
                    </div>

                    <div style={{ marginTop: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="node-field-label" style={{ margin: 0 }}>
                          Multi-Action Buttons ({(Array.isArray(data.options) ? data.options : []).length})
                        </span>
                        <button
                          type="button"
                          className="node-add-subitem-btn"
                          onClick={() => handleAddOption(node.id)}
                          title="Add support action button"
                        >
                          + Add Action
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {(Array.isArray(data.options) ? data.options : []).map((opt: string, idx: number) => (
                          <div key={idx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="node-input-sm"
                              style={{ flex: 1 }}
                              value={opt}
                              placeholder={`Action ${idx + 1}`}
                              onChange={(e) => handleUpdateOption(node.id, idx, e.target.value)}
                            />
                            <button
                              type="button"
                              className="node-del-subitem-btn"
                              title={`Delete "${opt}"`}
                              onClick={() => handleDeleteOption(node.id, idx, opt)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* In-Node Next Step Connection Dropdown for quick easy linking */}
                {isCondition ? (
                  <div className="node-connect-dropdown-row">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#10B981' }}>If True ➔ Next Node:</span>
                      <select
                        className="node-input-sm"
                        value={flow.edges.find((e) => e.sourceNodeId === node.id && e.sourceHandle === 'true')?.targetNodeId || 'none'}
                        onChange={(e) => handleDropdownConnect(node.id, e.target.value, 'true')}
                      >
                        <option value="none">-- Select Target Node --</option>
                        {flow.nodes.filter((n) => n.id !== node.id && n.type !== 'TRIGGER').map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.title} ({n.type})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#EF4444' }}>If False ➔ Next Node:</span>
                      <select
                        className="node-input-sm"
                        value={flow.edges.find((e) => e.sourceNodeId === node.id && e.sourceHandle === 'false')?.targetNodeId || 'none'}
                        onChange={(e) => handleDropdownConnect(node.id, e.target.value, 'false')}
                      >
                        <option value="none">-- Select Target Node --</option>
                        {flow.nodes.filter((n) => n.id !== node.id && n.type !== 'TRIGGER').map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.title} ({n.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : !isTerminal ? (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-light)' }}>
                    {/* Dynamic Repeatable Header with Add Step Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                        Next step / Connect to ({branchItems.length}):
                      </span>
                      <button
                        type="button"
                        className="node-add-subitem-btn"
                        onClick={() => handleAddStep(node.id)}
                        title="Add dynamic step / branch"
                      >
                        + Add Step
                      </button>
                    </div>

                    {/* Dynamic Repeatable List of Step Entries */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {branchItems.map((item) => (
                        <div
                          key={item.handle || item.index}
                          style={{
                            display: 'flex',
                            gap: '4px',
                            alignItems: 'center',
                            background: branchItems.length > 1 ? 'var(--bg-input)' : 'transparent',
                            padding: branchItems.length > 1 ? '4px' : '0',
                            borderRadius: '4px',
                            border: branchItems.length > 1 ? '1px solid var(--border-light)' : 'none',
                          }}
                        >
                          {/* If multiple dynamic entries, show editable step/action label */}
                          {branchItems.length > 1 && (
                            <input
                              type="text"
                              className="node-input-sm"
                              style={{ width: '95px', flexShrink: 0, padding: '3px 6px', fontWeight: 600 }}
                              value={item.label}
                              placeholder={`Step ${item.index + 1}`}
                              title="Step / Action Label"
                              onChange={(e) =>
                                handleUpdateStepLabel(node.id, item.index, item.handle, e.target.value)
                              }
                            />
                          )}

                          {/* Target Node Selection Dropdown */}
                          <select
                            className="node-input-sm"
                            style={{ flex: 1 }}
                            value={item.edge?.targetNodeId || 'none'}
                            onChange={(e) => handleDropdownConnect(node.id, e.target.value, item.handle)}
                          >
                            <option value="none">-- Select Target Node --</option>
                            {flow.nodes
                              .filter((n) => n.id !== node.id && n.type !== 'TRIGGER')
                              .map((n) => (
                                <option key={n.id} value={n.id}>
                                  {n.title} ({n.type})
                                </option>
                              ))}
                          </select>

                          {/* Delete Item Button (removes 1 if there are 3, or clears connection) */}
                          <button
                            type="button"
                            className="node-del-subitem-btn"
                            title={`Remove step "${item.label}"`}
                            onClick={() => handleRemoveStep(node.id, item.index, item.handle)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Right Output Port Handles */}
              {!isTerminal && (
                <>
                  {isCondition ? (
                    <>
                      <div
                        className={`node-port-handle output-true ${connectingSource?.nodeId === node.id && connectingSource?.handle === 'true' ? 'connecting-source' : ''}`}
                        title="Connect True branch"
                        onClick={(e) => handlePortClick(node.id, 'true', false, e)}
                      />
                      <span className="port-label true-label">True</span>

                      <div
                        className={`node-port-handle output-false ${connectingSource?.nodeId === node.id && connectingSource?.handle === 'false' ? 'connecting-source' : ''}`}
                        title="Connect False branch"
                        onClick={(e) => handlePortClick(node.id, 'false', false, e)}
                      />
                      <span className="port-label false-label">False</span>
                    </>
                  ) : data.options && Array.isArray(data.options) && data.options.length > 1 ? (
                    <>
                      {data.options.map((opt: string, i: number) => {
                        const topOffset = 48 + i * 36;
                        const isConnectingThis =
                          connectingSource?.nodeId === node.id && connectingSource?.handle === opt;
                        return (
                          <React.Fragment key={opt}>
                            <div
                              className={`node-port-handle multi-branch-port ${isConnectingThis ? 'connecting-source' : ''}`}
                              style={{ top: `${topOffset}px` }}
                              title={`Connect branch: "${opt}"`}
                              onClick={(e) => handlePortClick(node.id, opt, false, e)}
                            />
                            <span
                              className="port-label multi-branch-label"
                              style={{ top: `${topOffset - 7}px` }}
                              title={opt}
                            >
                              {opt.length > 14 ? opt.slice(0, 12) + '..' : opt}
                            </span>
                          </React.Fragment>
                        );
                      })}
                    </>
                  ) : (
                    <div
                      className={`node-port-handle output ${connectingSource?.nodeId === node.id && connectingSource?.handle === 'default' ? 'connecting-source' : ''}`}
                      title="Connect to next step"
                      onClick={(e) => handlePortClick(node.id, 'default', false, e)}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NodeCanvas;
