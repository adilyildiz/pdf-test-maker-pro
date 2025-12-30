
import React, { useState, useEffect, useRef } from 'react';
import { Question } from '../types';
import { TrashIcon } from './icons';

// Simple Rich Text Editor component for basic formatting
const RichTextEditor: React.FC<{ value: string; onChange: (value: string) => void; }> = ({ value, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    onChange(e.currentTarget.innerHTML);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '<br />');
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }
  };

  const execCmd = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, undefined);
    if(editorRef.current) {
        onChange(editorRef.current.innerHTML);
    }
  };

  const ToolbarButton: React.FC<{ onClick: () => void; title: string; children: React.ReactNode}> = ({onClick, title, children}) => (
      <button 
        type="button" 
        onClick={onClick}
        onMouseDown={e => e.preventDefault()}
        className="px-2 py-1 w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-600 transition-colors font-mono text-lg"
        title={title}
      >
        {children}
      </button>
  );

  return (
    <div className="bg-slate-700 border border-slate-600 rounded-md focus-within:ring-2 focus-within:ring-cyan-500 focus-within:border-cyan-500 transition">
      <div className="flex items-center space-x-1 border-b border-slate-600 p-1">
        <ToolbarButton onClick={() => execCmd('bold')} title="Kalın (Ctrl+B)"><b>B</b></ToolbarButton>
        <ToolbarButton onClick={() => execCmd('italic')} title="İtalik (Ctrl+I)"><i>I</i></ToolbarButton>
        <ToolbarButton onClick={() => execCmd('underline')} title="Altı Çizili (Ctrl+U)"><u>U</u></ToolbarButton>
      </div>
      <div
        ref={editorRef}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        contentEditable={true}
        className="w-full bg-slate-700 rounded-b-md p-2 outline-none"
        style={{ minHeight: '120px' }}
      />
    </div>
  );
};


interface QuestionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (question: Question) => void;
  questionToEdit: Question | null;
}

const initialQuestionState: Question = {
  id: '',
  text: '',
  image: null,
  answers: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }, { text: '' }],
  correctAnswerIndex: 0,
};

export const QuestionEditor: React.FC<QuestionEditorProps> = ({ isOpen, onClose, onSave, questionToEdit }) => {
  const [question, setQuestion] = useState<Question>(initialQuestionState);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (questionToEdit) {
        setQuestion(questionToEdit);
      } else {
        setQuestion(initialQuestionState);
      }
      setError(null);
    }
  }, [questionToEdit, isOpen]);

  const handleTextChange = (value: string) => {
    setQuestion({ ...question, text: value });
    if (error) setError(null);
  };

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...question.answers];
    newAnswers[index] = { text: value };
    setQuestion({ ...question, answers: newAnswers });
    if (error) setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setQuestion({ ...question, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setQuestion({ ...question, image: null });
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    if (question.text.trim() === '' || question.text.trim() === '<br>') {
        setError('Soru metni boş olamaz.');
        return;
    }
    const filledAnswers = question.answers.filter(a => a.text.trim() !== '');
    if (filledAnswers.length < 2) {
        setError('Lütfen en az iki cevap şıkkı girin.');
        return;
    }
    onSave({ ...question, id: question.id || new Date().toISOString() });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700">
        <h2 className="text-2xl font-bold mb-4 text-cyan-400">{questionToEdit ? 'Soruyu Düzenle' : 'Yeni Soru Ekle'}</h2>
        
        {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500 text-red-200 text-sm rounded-md flex items-center gap-2">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                {error}
            </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Soru Metni</label>
            <RichTextEditor
              value={question.text}
              onChange={handleTextChange}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Görsel (İsteğe Bağlı)</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100" />
            {question.image && (
                <div className="mt-2 relative inline-block">
                    <img src={question.image} alt="Önizleme" className="rounded-md max-h-40" />
                    <button 
                        onClick={handleRemoveImage}
                        title="Görseli Kaldır"
                        aria-label="Görseli kaldır"
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Cevap Şıkları</label>
            <div className="space-y-2">
              {question.answers.map((answer, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="font-mono text-cyan-400">{String.fromCharCode(65 + index)}.</span>
                  <input
                    type="text"
                    value={answer.text}
                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                    placeholder={index < 2 ? "Zorunlu şık" : "Opsiyonel şık"}
                    className="flex-grow bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Doğru Cevap</label>
            <select
              value={question.correctAnswerIndex}
              onChange={(e) => setQuestion({ ...question, correctAnswerIndex: parseInt(e.target.value) })}
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
            >
              {question.answers.map((answer, index) => (
                 answer.text.trim() && <option key={index} value={index}>{String.fromCharCode(65 + index)}: {answer.text.substring(0, 30)}...</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 transition">İptal</button>
          <button onClick={handleSave} className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 font-semibold transition">Soruyu Kaydet</button>
        </div>
      </div>
    </div>
  );
};
