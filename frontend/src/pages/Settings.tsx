import { useEffect, useState } from 'react'
import { Row, Col, Card, Form, Button, Badge, Modal, Alert, InputGroup, Spinner } from 'react-bootstrap'
// Note: releaseDate state removed — managed via Reports page
import {
  getPortalStatus, savePortalCredentials, testPortalConnection,
  getLabels, createLabel, updateLabel, deleteLabel,
} from '../api/client'
import type { Label } from '../types'

export default function Settings() {
  const [portalUrl, setPortalUrl] = useState('https://hornerautomation.mantishub.io')
  const [apiToken, setApiToken] = useState('')
  const [configured, setConfigured] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)
  const [portalMsg, setPortalMsg] = useState('')

  const [labels, setLabels] = useState<Label[]>([])
  const [labelModal, setLabelModal] = useState(false)
  const [editingLabel, setEditingLabel] = useState<Label | null>(null)
  const [labelName, setLabelName] = useState('')
  const [labelColor, setLabelColor] = useState('#0d6efd')
  const [labelSaving, setLabelSaving] = useState(false)
  const [labelError, setLabelError] = useState('')

  const loadLabels = () => getLabels().then(setLabels)

  useEffect(() => {
    getPortalStatus().then(s => {
      setConfigured(s.configured)
      if (s.portal_url) setPortalUrl(s.portal_url)
    })
    loadLabels()
  }, [])

  const handleSavePortal = async () => {
    setSaving(true)
    setPortalMsg('')
    setTestResult(null)
    try {
      await savePortalCredentials(portalUrl, apiToken)
      setConfigured(true)
      setApiToken('')
      setPortalMsg('Credentials saved successfully.')
    } catch (e: any) {
      setPortalMsg(e?.response?.data?.detail ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await testPortalConnection()
      setTestResult(r.ok ? 'ok' : 'fail')
    } catch {
      setTestResult('fail')
    } finally {
      setTesting(false)
    }
  }

  const openNewLabel = () => {
    setEditingLabel(null)
    setLabelName('')
    setLabelColor('#0d6efd')
    setLabelError('')
    setLabelModal(true)
  }

  const openEditLabel = (l: Label) => {
    setEditingLabel(l)
    setLabelName(l.name)
    setLabelColor(l.color)
    setLabelError('')
    setLabelModal(true)
  }

  const handleSaveLabel = async () => {
    if (!labelName.trim()) { setLabelError('Name is required.'); return }
    setLabelSaving(true)
    setLabelError('')
    try {
      if (editingLabel) {
        await updateLabel(editingLabel.id, { name: labelName, color: labelColor })
      } else {
        await createLabel({ name: labelName, color: labelColor })
      }
      setLabelModal(false)
      loadLabels()
    } catch (e: any) {
      setLabelError(e?.response?.data?.detail ?? 'Save failed.')
    } finally {
      setLabelSaving(false)
    }
  }

  const handleDeleteLabel = async (id: number) => {
    await deleteLabel(id)
    loadLabels()
  }

  return (
    <>
      <Row className="g-4 mt-0">
        {/* Portal credentials */}
        <Col xs={12} lg={6}>
          <Card className="border-0 shadow-sm rounded-3 h-100">
            <Card.Header className="bg-white border-bottom fw-semibold d-flex align-items-center justify-content-between">
              <span><i className="bi bi-plugin me-2 text-primary" />Mantis Bug Portal</span>
              {configured
                ? <Badge bg="success" className="fw-normal"><i className="bi bi-check-circle me-1" />Configured</Badge>
                : <Badge bg="warning" text="dark" className="fw-normal">Not Set</Badge>}
            </Card.Header>
            <Card.Body>
              {configured && (
                <Alert variant="info" className="small py-2">
                  <i className="bi bi-info-circle me-1" />Connected to: <strong>{portalUrl}</strong>
                </Alert>
              )}

              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">Portal URL</Form.Label>
                <Form.Control
                  size="sm"
                  value={portalUrl}
                  onChange={e => setPortalUrl(e.target.value)}
                  placeholder="https://yourportal.mantishub.io"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">
                  API Token {configured && <span className="text-muted fw-normal">(leave blank to keep existing)</span>}
                </Form.Label>
                <Form.Control
                  size="sm"
                  type="password"
                  value={apiToken}
                  onChange={e => setApiToken(e.target.value)}
                  placeholder="Paste your Mantis API token"
                />
                <Form.Text className="text-muted">
                  Get it from: <code>your-portal/account_api_token_page.php</code>
                </Form.Text>
              </Form.Group>

              {portalMsg && (
                <Alert variant={portalMsg.includes('success') ? 'success' : 'danger'} className="small py-2">
                  {portalMsg}
                </Alert>
              )}
              {testResult === 'ok' && (
                <Alert variant="success" className="small py-2">
                  <i className="bi bi-check-circle me-1" />Connection successful!
                </Alert>
              )}
              {testResult === 'fail' && (
                <Alert variant="danger" className="small py-2">
                  <i className="bi bi-x-circle me-1" />Connection failed. Check URL and token.
                </Alert>
              )}

              <div className="d-flex gap-2">
                <Button variant="primary" size="sm" onClick={handleSavePortal} disabled={saving}>
                  {saving ? <Spinner animation="border" size="sm" className="me-1" /> : <i className="bi bi-save me-1" />}
                  Save
                </Button>
                {configured && (
                  <Button variant="outline-secondary" size="sm" onClick={handleTest} disabled={testing}>
                    {testing ? <Spinner animation="border" size="sm" className="me-1" /> : <i className="bi bi-wifi me-1" />}
                    Test Connection
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Labels */}
        <Col xs={12} lg={6}>
          <Card className="border-0 shadow-sm rounded-3 h-100">
            <Card.Header className="bg-white border-bottom fw-semibold d-flex align-items-center justify-content-between">
              <span><i className="bi bi-tags me-2 text-primary" />Labels</span>
              <Button variant="primary" size="sm" onClick={openNewLabel}>
                <i className="bi bi-plus me-1" />New Label
              </Button>
            </Card.Header>
            <Card.Body>
              <div className="d-flex flex-wrap gap-2">
                {labels.map(l => (
                  <div
                    key={l.id}
                    className="d-flex align-items-center gap-1 rounded-pill px-3 py-1"
                    style={{ background: `${l.color}22`, border: `1px solid ${l.color}` }}
                  >
                    <span
                      className="fw-semibold small"
                      style={{ color: l.color, cursor: 'pointer' }}
                      onClick={() => openEditLabel(l)}
                    >
                      {l.name}
                    </span>
                    <button
                      className="btn-close btn-close-sm ms-1"
                      style={{ fontSize: '0.55rem' }}
                      onClick={() => handleDeleteLabel(l.id)}
                    />
                  </div>
                ))}
                {labels.length === 0 && (
                  <p className="text-muted small">No labels yet. Create one to tag your tasks.</p>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Release Date — moved to Reports */}
        <Col xs={12} lg={6}>
          <Card className="border-0 shadow-sm rounded-3 h-100">
            <Card.Header className="bg-white border-bottom fw-semibold d-flex align-items-center gap-2">
              <i className="bi bi-rocket-takeoff text-primary" />
              Releases
            </Card.Header>
            <Card.Body className="d-flex align-items-center gap-3">
              <i className="bi bi-bar-chart-line fs-2 text-primary" />
              <div>
                <div className="fw-semibold small">Release management has moved to the Reports page.</div>
                <div className="text-muted small mt-1">Go to <strong>Reports</strong> in the sidebar to create releases, set the active release, and view team performance reports.</div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* About */}
        <Col xs={12} lg={6}>
          <Card className="border-0 shadow-sm rounded-3 h-100">
            <Card.Body className="d-flex align-items-center gap-3">
              <i className="bi bi-kanban fs-2 text-primary" />
              <div>
                <div className="fw-bold">PrimeDesk v1.0</div>
                <div className="text-muted small">Prime Team Task Manager — built for Prime Team</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Label Modal */}
      <Modal show={labelModal} onHide={() => setLabelModal(false)} centered size="sm">
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title className="fs-6 fw-bold">
            {editingLabel ? 'Edit Label' : 'New Label'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {labelError && <Alert variant="danger" className="py-2 small">{labelError}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold">Label Name</Form.Label>
            <Form.Control
              size="sm"
              placeholder="e.g. Frontend, Critical, QA"
              value={labelName}
              onChange={e => setLabelName(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label className="small fw-semibold">Color</Form.Label>
            <div className="d-flex align-items-center gap-3">
              <Form.Control
                type="color"
                value={labelColor}
                onChange={e => setLabelColor(e.target.value)}
                style={{ width: 60, height: 36, padding: 2 }}
              />
              <span
                className="badge px-3 py-2"
                style={{ background: labelColor, fontSize: '0.85rem' }}
              >
                {labelName || 'Preview'}
              </span>
            </div>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-top">
          <Button variant="light" size="sm" onClick={() => setLabelModal(false)}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSaveLabel} disabled={labelSaving}>
            {labelSaving ? <Spinner animation="border" size="sm" className="me-1" /> : null}
            {editingLabel ? 'Save' : 'Create'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
