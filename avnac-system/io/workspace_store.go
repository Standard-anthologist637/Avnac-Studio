package avnacio

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type documentMeta struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	UpdatedAt     int64  `json:"updatedAt"`
	ArtboardWidth int    `json:"artboardWidth"`
	ArtboardHeight int   `json:"artboardHeight"`
}

type documentRecordEnvelope struct {
	ID        string          `json:"id"`
	Name      string          `json:"name,omitempty"`
	UpdatedAt int64           `json:"updatedAt"`
	Document  json.RawMessage `json:"document"`
}

type documentRecordDecode struct {
	Name      string          `json:"name"`
	UpdatedAt int64           `json:"updatedAt"`
	Document  json.RawMessage `json:"document"`
	Artboard  struct {
		Width  int `json:"width"`
		Height int `json:"height"`
	} `json:"-"`
}

type documentFileDecode struct {
	Artboard struct {
		Width  int `json:"width"`
		Height int `json:"height"`
	} `json:"artboard"`
}

func normalizeDocumentName(name string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "Untitled"
	}
	return trimmed
}

func decodeDocumentMeta(id string, record string) (documentMeta, json.RawMessage, error) {
	var envelope documentRecordEnvelope
	if err := json.Unmarshal([]byte(record), &envelope); err != nil {
		return documentMeta{}, nil, fmt.Errorf("decode document record: %w", err)
	}
	if len(envelope.Document) == 0 {
		return documentMeta{}, nil, fmt.Errorf("document record missing document payload")
	}
	var document documentFileDecode
	if err := json.Unmarshal(envelope.Document, &document); err != nil {
		return documentMeta{}, nil, fmt.Errorf("decode document payload: %w", err)
	}
	updatedAt := envelope.UpdatedAt
	if updatedAt <= 0 {
		updatedAt = time.Now().UnixMilli()
	}
	return documentMeta{
		ID:             id,
		Name:           normalizeDocumentName(envelope.Name),
		UpdatedAt:      updatedAt,
		ArtboardWidth:  document.Artboard.Width,
		ArtboardHeight: document.Artboard.Height,
	}, envelope.Document, nil
}

func (m *IOManager) readWorkspaceJSON(persistId string, fileName string) (string, error) {
	path, err := m.workspaceFilePath(persistId, fileName)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (m *IOManager) writeWorkspaceJSON(persistId string, fileName string, raw string) error {
	path, err := m.workspaceFilePath(persistId, fileName)
	if err != nil {
		return err
	}
	return writeWorkspaceFile(path, []byte(raw))
}

func (m *IOManager) documentMetaPath(persistId string) (string, error) {
	return m.workspaceFilePath(persistId, documentMetaFileName)
}

func (m *IOManager) documentPath(persistId string) (string, error) {
	return m.workspaceFilePath(persistId, documentFileName)
}

func (m *IOManager) vectorBoardsPath(persistId string) (string, error) {
	return m.workspaceFilePath(persistId, vectorBoardsFileName)
}

func (m *IOManager) vectorBoardDocsPath(persistId string) (string, error) {
	return m.workspaceFilePath(persistId, vectorBoardDocsFileName)
}

func (m *IOManager) ListDocuments() (string, error) {
	root, err := m.documentsRoot()
	if err != nil {
		return "", err
	}
	entries, err := os.ReadDir(root)
	if os.IsNotExist(err) {
		return "[]", nil
	}
	if err != nil {
		return "", fmt.Errorf("list documents: %w", err)
	}
	items := make([]documentMeta, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		metaPath := filepath.Join(root, entry.Name(), documentMetaFileName)
		data, err := os.ReadFile(metaPath)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return "", fmt.Errorf("read document meta: %w", err)
		}
		var item documentMeta
		if err := json.Unmarshal(data, &item); err != nil {
			continue
		}
		if item.ID == "" {
			item.ID = entry.Name()
		}
		if item.Name == "" {
			item.Name = "Untitled"
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].UpdatedAt > items[j].UpdatedAt
	})
	data, err := json.Marshal(items)
	if err != nil {
		return "", fmt.Errorf("encode document list: %w", err)
	}
	return string(data), nil
}

func (m *IOManager) ReadDocumentRecord(persistId string) (string, error) {
	metaPath, err := m.documentMetaPath(persistId)
	if err != nil {
		return "", err
	}
	documentPath, err := m.documentPath(persistId)
	if err != nil {
		return "", err
	}
	rawDocument, err := os.ReadFile(documentPath)
	if os.IsNotExist(err) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("read document file: %w", err)
	}
	meta := documentMeta{
		ID:   persistId,
		Name: "Untitled",
	}
	if rawMeta, err := os.ReadFile(metaPath); err == nil {
		_ = json.Unmarshal(rawMeta, &meta)
	} else if err != nil && !os.IsNotExist(err) {
		return "", fmt.Errorf("read document meta: %w", err)
	}
	envelope := documentRecordEnvelope{
		ID:        persistId,
		Name:      normalizeDocumentName(meta.Name),
		UpdatedAt: meta.UpdatedAt,
		Document:  json.RawMessage(rawDocument),
	}
	data, err := json.Marshal(envelope)
	if err != nil {
		return "", fmt.Errorf("encode document record: %w", err)
	}
	return string(data), nil
}

func (m *IOManager) WriteDocumentRecord(persistId string, record string) error {
	meta, rawDocument, err := decodeDocumentMeta(persistId, record)
	if err != nil {
		return err
	}
	documentPath, err := m.documentPath(persistId)
	if err != nil {
		return err
	}
	metaPath, err := m.documentMetaPath(persistId)
	if err != nil {
		return err
	}
	metaJSON, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return fmt.Errorf("encode document meta: %w", err)
	}
	if err := writeWorkspaceFile(documentPath, rawDocument); err != nil {
		return fmt.Errorf("write document file: %w", err)
	}
	if err := writeWorkspaceFile(metaPath, metaJSON); err != nil {
		return fmt.Errorf("write document meta: %w", err)
	}
	return nil
}

func (m *IOManager) DeleteDocument(persistId string) error {
	dir, err := m.workspaceDir(persistId)
	if err != nil {
		return err
	}
	if err := os.RemoveAll(dir); err != nil {
		return fmt.Errorf("delete document: %w", err)
	}
	return nil
}

func (m *IOManager) ReadVectorBoards(persistId string) (string, error) {
	return m.readWorkspaceJSON(persistId, vectorBoardsFileName)
}

func (m *IOManager) WriteVectorBoards(persistId string, raw string) error {
	if err := m.writeWorkspaceJSON(persistId, vectorBoardsFileName, raw); err != nil {
		return fmt.Errorf("write vector boards: %w", err)
	}
	return nil
}

func (m *IOManager) ReadVectorBoardDocs(persistId string) (string, error) {
	return m.readWorkspaceJSON(persistId, vectorBoardDocsFileName)
}

func (m *IOManager) WriteVectorBoardDocs(persistId string, raw string) error {
	if err := m.writeWorkspaceJSON(persistId, vectorBoardDocsFileName, raw); err != nil {
		return fmt.Errorf("write vector board docs: %w", err)
	}
	return nil
}