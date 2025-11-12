
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { TestDetails, Question, Answer } from './types';
import { QuestionEditor } from './components/QuestionEditor';
import { TestPreview } from './components/TestPreview';
import { AnswerKeyPreview } from './components/AnswerKeyPreview';
import { OpticalForm } from './components/OpticalForm';
import { PlusIcon, TrashIcon, EditIcon, SpinnerIcon, DownloadIcon, UploadIcon } from './components/icons';

// Declare globals from included scripts to satisfy TypeScript
declare var jspdf: any;
declare var html2canvas: any;

// Helper to strip HTML for plain text previews
const stripHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
};

// Helper to shuffle array non-destructively
const shuffleArray = (array: any[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

// A utility component for measuring content height during pagination
const PaginateMeasure: React.FC<{
    details: TestDetails;
    questions: Question[];
    onMeasure: (height: number) => void;
}> = ({ details, questions, onMeasure }) => {
    const measureRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (measureRef.current) {
            onMeasure(measureRef.current.scrollHeight);
        }
    }, [questions, onMeasure]);

    return (
        <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
            <TestPreview innerRef={measureRef} details={details} questions={questions} isMeasureOnly />
        </div>
    );
};


const DetailInput: React.FC<{label: string, name: keyof TestDetails, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void}> = ({label, name, value, onChange}) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-slate-300">{label}</label>
        <input type="text" id={name} name={name} value={value} onChange={onChange} className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"/>
    </div>
);

const App: React.FC = () => {
  const [testDetails, setTestDetails] = useState<TestDetails>({
    schoolYear: '2025 - 2026',
    faculty: 'BİLGİSAYAR VE BİLİŞİM BİLİMLERİ FAKÜLTESİ',
    department: 'DİJİTAL OYUN TASARIMI BÖLÜMÜ',
    course: 'TEMEL BİLGİ TEKNOLOJİLERİ',
    examType: 'ÇOKTAN SEÇMELİ TEST SINAVI',
    booklet: 'A', // Default, will be overridden during generation
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [numberOfBooklets, setNumberOfBooklets] = useState(2);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const [currentlyRenderingPage, setCurrentlyRenderingPage] = useState<{ bookletType: string; questions: Question[] } | null>(null);
  const [currentlyRenderingOpticalForm, setCurrentlyRenderingOpticalForm] = useState<string | null>(null);
  const [answerKeyData, setAnswerKeyData] = useState<Array<{ bookletType: string; questions: Question[] }> | null>(null);
  const [pdfGenerationMessage, setPdfGenerationMessage] = useState('');

  const previewRef = useRef<HTMLDivElement>(null);
  const answerKeyRef = useRef<HTMLDivElement>(null);
  const opticalFormRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const pageQueueRef = useRef<Array<{ bookletType: string; questions: Question[] }>>([]);
  const opticalFormQueueRef = useRef<string[]>([]);

  // Load all data from localStorage on initial render
  useEffect(() => {
    try {
        const savedData = localStorage.getItem('pdfTestData');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            if (parsedData.testDetails) setTestDetails(parsedData.testDetails);
            if (parsedData.questions) setQuestions(parsedData.questions);
        }
    } catch (error) {
        console.error("Veri localStorage'dan yüklenemedi", error);
    }
  }, []);

  // Save all data to localStorage whenever it changes
  useEffect(() => {
    try {
        const dataToSave = { testDetails, questions };
        localStorage.setItem('pdfTestData', JSON.stringify(dataToSave));
    } catch (error) {
        console.error("Veri localStorage'a kaydedilemedi", error);
    }
  }, [testDetails, questions]);

  const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTestDetails({ ...testDetails, [e.target.name]: e.target.value });
  };
  
  const handleBookletCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setNumberOfBooklets(parseInt(e.target.value));
  };

  const openEditorForNew = () => {
    setEditingQuestion(null);
    setIsEditorOpen(true);
  };
  
  const openEditorForEdit = (question: Question) => {
    setEditingQuestion(question);
    setIsEditorOpen(true);
  };

  const handleSaveQuestion = (question: Question) => {
    if (editingQuestion) {
      setQuestions(questions.map(q => q.id === question.id ? question : q));
    } else {
      setQuestions([...questions, question]);
    }
  };

  const deleteQuestion = (id: string) => {
    if (window.confirm('Bu soruyu silmek istediğinizden emin misiniz?')) {
        setQuestions(questions.filter(q => q.id !== id));
    }
  };
  
  const shuffleQuestionsAndAnswers = (originalQuestions: Question[]): Question[] => {
      const questionsWithOriginalIndex = originalQuestions.map((q, index) => ({...q, originalIndex: index}));
      const shuffledQuestions = shuffleArray(questionsWithOriginalIndex);
      
      return shuffledQuestions.map(q => {
          const validAnswers = q.answers.filter(a => a.text.trim() !== '');
          const correctAnswerText = validAnswers[q.correctAnswerIndex]?.text;
          
          if (!correctAnswerText) {
             return { ...q, answers: shuffleArray(q.answers) };
          }
          
          const shuffledValidAnswers = shuffleArray(validAnswers);
          const newCorrectIndex = shuffledValidAnswers.findIndex(a => a.text === correctAnswerText);

          const newAnswers = [...shuffledValidAnswers];
          while (newAnswers.length < q.answers.length) {
              newAnswers.push({ text: '' });
          }

          return {
              ...q,
              answers: newAnswers,
              correctAnswerIndex: newCorrectIndex,
          };
      });
  };
  
  const resetPdfGenerationState = () => {
    setIsGeneratingPdf(false);
    setCurrentlyRenderingPage(null);
    setCurrentlyRenderingOpticalForm(null);
    setAnswerKeyData(null);
    setPdfGenerationMessage('');
    pdfDocRef.current = null;
    pageQueueRef.current = [];
    opticalFormQueueRef.current = [];
  };

  const paginate = useCallback((allQuestions: Question[], bookletDetails: TestDetails): Promise<Question[][]> => {
    return new Promise((resolve) => {
        const A4_CONTENT_HEIGHT_PX = 900; // Use a safe height to avoid overflow
        const measureRootEl = document.createElement('div');
        document.body.appendChild(measureRootEl);
        const measureRoot = ReactDOM.createRoot(measureRootEl);

        const pages: Question[][] = [];
        let currentPageQuestions: Question[] = [];
        let remainingQuestions = [...allQuestions];

        const processQuestion = () => {
            if (remainingQuestions.length === 0) {
                if (currentPageQuestions.length > 0) {
                    pages.push(currentPageQuestions);
                }
                measureRoot.unmount();
                if (document.body.contains(measureRootEl)) {
                    document.body.removeChild(measureRootEl);
                }
                resolve(pages);
                return;
            }

            const nextQuestion = remainingQuestions.shift()!;
            const potentialPageQuestions = [...currentPageQuestions, nextQuestion];

            const handleMeasure = (height: number) => {
                if (height > A4_CONTENT_HEIGHT_PX && currentPageQuestions.length > 0) {
                    pages.push(currentPageQuestions);
                    currentPageQuestions = [nextQuestion];
                } else {
                    currentPageQuestions = potentialPageQuestions;
                }
                // Process the next question in the next tick
                setTimeout(processQuestion, 0);
            };

            measureRoot.render(
                <PaginateMeasure
                    details={bookletDetails}
                    questions={potentialPageQuestions}
                    onMeasure={handleMeasure}
                />
            );
        };

        processQuestion();
    });
}, []);

  const handleGeneratePdf = async () => {
    if (questions.length === 0) {
        alert("PDF oluşturmadan önce lütfen en az bir soru ekleyin.");
        return;
    }

    setIsGeneratingPdf(true);
    setPdfGenerationMessage('Kitapçıklar hazırlanıyor...');
    
    const { jsPDF } = jspdf;
    pdfDocRef.current = new jsPDF('p', 'mm', 'a4');
    
    const booklets = [];
    for (let i = 0; i < numberOfBooklets; i++) {
        const bookletType = String.fromCharCode(65 + i);
        booklets.push({
            bookletType,
            questions: shuffleQuestionsAndAnswers(JSON.parse(JSON.stringify(questions)))
        });
    }

    setAnswerKeyData([...booklets]);
    
    pageQueueRef.current = [];

    for (const [index, booklet] of booklets.entries()) {
        setPdfGenerationMessage(`Kitapçık ${booklet.bookletType} sayfalara ayrılıyor... (${index + 1}/${booklets.length})`);
        const bookletDetails = { ...testDetails, booklet: booklet.bookletType };
        const paginated = await paginate(booklet.questions, bookletDetails);
        
        for (const pageQuestions of paginated) {
            pageQueueRef.current.push({
                bookletType: booklet.bookletType,
                questions: pageQuestions,
            });
        }
    }

    const firstPage = pageQueueRef.current.shift();
    if (firstPage) {
        setCurrentlyRenderingPage(firstPage);
    } else {
        // No pages to render, maybe only an answer key?
        // This case should be handled by the useEffect that watches currentlyRenderingPage
        setCurrentlyRenderingPage(null); 
    }
  };

  const handleExport = () => {
    const dataToExport = { testDetails, questions };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sinav-verileri.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportGift = () => {
    if (questions.length === 0) {
        alert("Dışa aktarılacak soru bulunmuyor.");
        return;
    }

    const escapeGiftText = (text: string): string => {
        return text.replace(/([~=#{}])/g, '\\$1');
    };

    const giftContent = questions.map((q, index) => {
        const title = `Soru ${index + 1}`;
        const text = `[html]${q.text}`;

        const answers = q.answers
            .map((ans, ansIndex) => {
                if (ans.text.trim() === '') return null;
                const prefix = ansIndex === q.correctAnswerIndex ? '=' : '~';
                return `${prefix}${escapeGiftText(ans.text.trim())}`;
            })
            .filter(Boolean)
            .join('\n');

        return `::${title}::${text}{\n${answers}\n}`;
    }).join('\n\n');

    const blob = new Blob([giftContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sinav-sorulari.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
  
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("Dosya metin olarak okunamadı.");
        const importedData = JSON.parse(text);
  
        if (!importedData.testDetails || !Array.isArray(importedData.questions)) {
           throw new Error("Geçersiz sınav verisi formatı. 'testDetails' ve 'questions' alanları bulunmalıdır.");
        }
  
        if (questions.length > 0 && !window.confirm("Mevcut sınav bilgileri ve soruların üzerine yazılsın mı? Bu işlem geri alınamaz.")) {
           return;
        }
        setTestDetails(importedData.testDetails);
        setQuestions(importedData.questions);
        alert(`Sınav detayları ve ${importedData.questions.length} soru başarıyla yüklendi.`);
  
      } catch (error) {
        console.error("Veri içe aktarma hatası:", error);
        alert("Sınav verisi yüklenirken bir hata oluştu. Lütfen dosyanın doğru formatta olduğundan emin olun.");
      } finally {
          event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const parseGiftFormat = (giftText: string): Question[] => {
    const parsedQuestions: Question[] = [];
    const blocks = giftText.replace(/\r\n/g, '\n').split(/(?:\s*\n){2,}/);

    blocks.forEach((block, blockIndex) => {
        block = block.trim();
        if (!block || block.startsWith('//')) {
            return; // Skip comments and empty blocks
        }

        const questionRegex = /(?:::(.*?)::)?(.*?)\{(.*?)\}/s;
        const match = block.match(questionRegex);

        if (!match) {
            console.warn(`GIFT formatında soru ayrıştırılamadı: Blok ${blockIndex + 1}`);
            return;
        }

        const [, , textContent, answersContent] = match;

        let questionText = textContent.trim();
        if (questionText.startsWith('[html]')) {
            questionText = questionText.substring(6).trim();
        }

        const answerLines = answersContent.trim().split('\n').filter(line => line.trim().match(/^[=~]/));
        
        const answers: Answer[] = [];
        let correctAnswerIndex = -1;

        answerLines.forEach(line => {
            const trimmedLine = line.trim();
            const isCorrect = trimmedLine.startsWith('=');
            
            const text = trimmedLine
                .replace(/^[=~]/, '')
                .replace(/#.*$/, '')
                .replace(/~?%-?\d+(\.\d+)?%/, '')
                .trim();

            if (text) {
                answers.push({ text });
                if (isCorrect) {
                    correctAnswerIndex = answers.length - 1;
                }
            }
        });

        if (questionText && answers.length >= 2 && correctAnswerIndex !== -1) {
            while (answers.length < 5) {
                answers.push({ text: '' });
            }

            parsedQuestions.push({
                id: new Date().toISOString() + `-${blockIndex}-${Math.random()}`,
                text: questionText,
                image: null,
                answers: answers,
                correctAnswerIndex: correctAnswerIndex,
            });
        } else {
            console.warn(`GIFT bloğu geçerli bir soruya dönüştürülemedi: Blok ${blockIndex + 1}`);
        }
    });

    return parsedQuestions;
};

const handleImportGift = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
  
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("Dosya metin olarak okunamadı.");
        
        const importedQuestions = parseGiftFormat(text);
  
        if (importedQuestions.length === 0) {
            alert("Dosya içinde geçerli GIFT formatında soru bulunamadı.");
            return;
        }
  
        if (questions.length > 0 && !window.confirm(`GIFT dosyasından ${importedQuestions.length} soru bulundu. Mevcut sorular silinip yenileri eklensin mi? Bu işlem geri alınamaz.`)) {
           return;
        }
        
        setQuestions(importedQuestions);
        alert(`${importedQuestions.length} soru başarıyla yüklendi.`);
  
      } catch (error) {
        console.error("GIFT verisi içe aktarma hatası:", error);
        alert("GIFT verisi yüklenirken bir hata oluştu. Lütfen dosyanın doğru formatta olduğundan emin olun ve konsolu kontrol edin.");
      } finally {
          event.target.value = ''; // Reset file input
      }
    };
    reader.readAsText(file);
};
  
  // Effect to handle rendering of test pages
  useEffect(() => {
    if (!isGeneratingPdf) return;

    if (currentlyRenderingPage) {
        const generatePage = async () => {
          if (!previewRef.current) return;
          
          const totalPagesInQueue = pageQueueRef.current.length + 1; // +1 for the current page
          const totalBooklets = answerKeyData?.length ?? 1;
          const totalOpticalForms = totalBooklets;
          const totalStaticPages = 1; // Answer Key
          const totalPages = (pageQueueRef.current.length + (answerKeyData?.flatMap(b => b.questions).length ?? 0) / questions.length) + totalStaticPages + totalOpticalForms;
          setPdfGenerationMessage(`Sayfa ${pdfDocRef.current.internal.getNumberOfPages() + 1} render ediliyor...`);
          
          try {
            const canvas = await html2canvas(previewRef.current, { scale: 2 });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            
            const pdf = pdfDocRef.current;
            if (pdf.internal.getNumberOfPages() > 0 && pdf.internal.getCurrentPageInfo().pageNumber !== 0) {
                 const pageInfo = pdf.internal.getPageInfo(pdf.internal.getCurrentPageInfo().pageNumber);
                 if (pageInfo.pageContext.annotations.length > 0) {
                    // This is not the first page, add a new one. The first page is blank by default.
                    pdf.addPage();
                 }
            }
             if (pdf.internal.getNumberOfPages() === 1 && pdf.internal.getPageInfo(1).pageContext.annotations.length === 0) {
                // First page is blank, do nothing.
             } else {
                pdf.addPage();
             }

            const a4Width_mm = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * a4Width_mm) / imgProps.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 0, a4Width_mm, pdfHeight);

            const nextPage = pageQueueRef.current.shift();
            setCurrentlyRenderingPage(nextPage || null);
          } catch (error) {
            console.error("PDF sayfası oluşturma hatası:", error);
            alert("PDF oluşturulurken bir hata oluştu. Lütfen konsolu kontrol edin.");
            resetPdfGenerationState();
          }
        };
        const timer = setTimeout(generatePage, 100);
        return () => clearTimeout(timer);
    } else if (answerKeyData) {
        // All pages are rendered, move to Answer Key and Optical Forms
        const generatePostPages = async () => {
            try {
                // 1. Generate Answer Key
                if (answerKeyRef.current) {
                    setPdfGenerationMessage('Cevap anahtarı oluşturuluyor...');
                    const answerCanvas = await html2canvas(answerKeyRef.current, { scale: 2 });
                    const answerImgData = answerCanvas.toDataURL('image/jpeg', 0.95);
                    const pdf = pdfDocRef.current;
                    pdf.addPage();
                    const a4Width_mm = pdf.internal.pageSize.getWidth();
                    const answerImgProps = pdf.getImageProperties(answerImgData);
                    const answerPdfHeight = (answerImgProps.height * a4Width_mm) / answerImgProps.width;
                    pdf.addImage(answerImgData, 'JPEG', 0, 0, a4Width_mm, answerPdfHeight);
                }
                
                // 2. Start optical form queue
                const opticalFormBooklets = answerKeyData?.map(b => b.bookletType) ?? [];
                opticalFormQueueRef.current = opticalFormBooklets;

                const nextFormBooklet = opticalFormQueueRef.current.shift();
                if (nextFormBooklet) {
                    setCurrentlyRenderingOpticalForm(nextFormBooklet);
                } else {
                    pdfDocRef.current.save(`test_${testDetails.course.replace(/\s/g, '_')}_cevapli.pdf`);
                    resetPdfGenerationState();
                }

            } catch (error) {
                console.error("Cevap anahtarı oluştururken hata:", error);
                alert("Cevap anahtarı oluşturulurken bir hata oluştu. PDF kaydedilemiyor.");
                resetPdfGenerationState();
            }
        };
        const timer = setTimeout(generatePostPages, 100);
        return () => clearTimeout(timer);
    }
  }, [isGeneratingPdf, currentlyRenderingPage, answerKeyData]);

  // Effect to handle rendering of optical forms
  useEffect(() => {
    if (!isGeneratingPdf || !currentlyRenderingOpticalForm) return;

    const generateFormPage = async () => {
        if (!opticalFormRef.current) return;
        
        const totalForms = answerKeyData?.length ?? 0;
        const currentFormIndex = totalForms - opticalFormQueueRef.current.length;
        
        setPdfGenerationMessage(`Optik form oluşturuluyor: ${currentlyRenderingOpticalForm} (${currentFormIndex}/${totalForms})`);

        try {
            const pdf = pdfDocRef.current;
            const canvas = await html2canvas(opticalFormRef.current, { scale: 2 });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            
            pdf.addPage();
            const a4Width_mm = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const pdfHeight = (imgProps.height * a4Width_mm) / imgProps.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, a4Width_mm, pdfHeight);

            const nextFormBooklet = opticalFormQueueRef.current.shift();
            if (nextFormBooklet) {
                setCurrentlyRenderingOpticalForm(nextFormBooklet);
            } else {
                setPdfGenerationMessage('PDF kaydediliyor...');
                pdf.save(`test_${testDetails.course.replace(/\s/g, '_')}_cevapli_optik.pdf`);
                resetPdfGenerationState();
            }
        } catch (error) {
            console.error("Optik form sayfası oluşturma hatası:", error);
            alert("Optik form oluşturulurken bir hata oluştu. Lütfen konsolu kontrol edin.");
            resetPdfGenerationState();
        }
    };
    
    const timer = setTimeout(generateFormPage, 100);
    return () => clearTimeout(timer);
  }, [isGeneratingPdf, currentlyRenderingOpticalForm, testDetails.course, answerKeyData]);

  const displayQuestions = currentlyRenderingPage?.questions ?? [];
  const displayBooklet = currentlyRenderingPage?.bookletType ?? testDetails.booklet;
  const displayDetails = {...testDetails, booklet: displayBooklet};

  return (
    <>
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">PDF Test Oluşturucu <span className="text-cyan-400">Pro</span></h1>
            <p className="mt-4 text-xl text-slate-400">Zahmetsizce profesyonel, iki sütunlu testler oluşturun.</p>
          </header>

          <main className="space-y-8">
            <section className="bg-slate-800 p-6 rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold border-b border-slate-700 pb-3 mb-4 text-cyan-400">Test Başlık Detayları</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DetailInput label="Eğitim Yılı" name="schoolYear" value={testDetails.schoolYear} onChange={handleDetailsChange} />
                  <DetailInput label="Fakülte" name="faculty" value={testDetails.faculty} onChange={handleDetailsChange} />
                  <DetailInput label="Bölüm" name="department" value={testDetails.department} onChange={handleDetailsChange} />
                  <DetailInput label="Ders" name="course" value={testDetails.course} onChange={handleDetailsChange} />
                  <DetailInput label="Sınav Türü" name="examType" value={testDetails.examType} onChange={handleDetailsChange} />
                  <div>
                    <label htmlFor="numberOfBooklets" className="block text-sm font-medium text-slate-300">Kitapçık Türü Sayısı</label>
                    <select id="numberOfBooklets" name="numberOfBooklets" value={numberOfBooklets} onChange={handleBookletCountChange} className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition">
                        <option value={1}>1 (A)</option>
                        <option value={2}>2 (A, B)</option>
                        <option value={3}>3 (A, B, C)</option>
                        <option value={4}>4 (A, B, C, D)</option>
                    </select>
                  </div>
              </div>
            </section>

            <section className="bg-slate-800 p-6 rounded-lg shadow-lg">
                <div className="flex flex-wrap gap-4 justify-between items-center border-b border-slate-700 pb-3 mb-4">
                    <h2 className="text-2xl font-bold text-cyan-400">Sorular ({questions.length})</h2>
                    <div className="flex items-center flex-wrap gap-3">
                        <button onClick={handleExport} title="Sınav Verilerini İndir (JSON)" className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-600 hover:bg-slate-500 font-semibold transition text-sm">
                            <DownloadIcon className="w-4 h-4"/> İndir (JSON)
                        </button>
                        <button onClick={handleExportGift} title="Soruları GIFT Formatında İndir" className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-600 hover:bg-slate-500 font-semibold transition text-sm">
                            <DownloadIcon className="w-4 h-4"/> İndir (GIFT)
                        </button>
                        <label title="Sınav Verilerini Yükle (JSON)" className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-md bg-slate-600 hover:bg-slate-500 font-semibold transition text-sm">
                            <UploadIcon className="w-4 h-4"/> Yükle (JSON)
                            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                        </label>
                         <label title="GIFT Dosyasından Soru Yükle" className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-md bg-slate-600 hover:bg-slate-500 font-semibold transition text-sm">
                            <UploadIcon className="w-4 h-4"/> Yükle (GIFT)
                            <input type="file" accept=".txt" onChange={handleImportGift} className="hidden" />
                        </label>
                        <button onClick={openEditorForNew} className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 font-semibold transition">
                            <PlusIcon className="w-5 h-5"/> Soru Ekle
                        </button>
                    </div>
                </div>
                <div className="space-y-3">
                    {questions.length === 0 && <p className="text-slate-400 text-center py-4">Henüz soru eklenmedi. Başlamak için 'Soru Ekle' düğmesine tıklayın.</p>}
                    {questions.map((q, index) => (
                        <div key={q.id} className="bg-slate-700 p-4 rounded-md flex justify-between items-start">
                           <div className="flex-1 overflow-hidden">
                                <p className="font-semibold truncate">{index + 1}. {stripHtml(q.text)}</p>
                                <p className="text-sm text-green-400 mt-1">Doğru Cevap: {String.fromCharCode(65 + q.correctAnswerIndex)}</p>
                           </div>
                           <div className="flex items-center space-x-2 ml-4">
                               <button onClick={() => openEditorForEdit(q)} className="p-2 text-slate-300 hover:text-cyan-400 transition"><EditIcon /></button>
                               <button onClick={() => deleteQuestion(q.id)} className="p-2 text-slate-300 hover:text-red-500 transition"><TrashIcon /></button>
                           </div>
                        </div>
                    ))}
                </div>
            </section>
            
            <section className="text-center py-4">
                 <button 
                    onClick={handleGeneratePdf} 
                    disabled={isGeneratingPdf || questions.length === 0}
                    className="w-full max-w-sm px-8 py-4 rounded-lg bg-green-600 hover:bg-green-500 font-bold text-xl transition disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-3 mx-auto"
                >
                    {isGeneratingPdf ? <><SpinnerIcon /> {pdfGenerationMessage || 'PDF Oluşturuluyor...'}</> : 'PDF Oluştur'}
                </button>
                {questions.length === 0 && <p className="text-sm text-yellow-400 mt-2">PDF oluşturmayı etkinleştirmek için en az bir soru ekleyin.</p>}
            </section>
          </main>
        </div>
      </div>

      <QuestionEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveQuestion}
        questionToEdit={editingQuestion}
      />
      
      <div className="absolute -left-[9999px] top-0">
        {isGeneratingPdf && currentlyRenderingPage && (
            <TestPreview innerRef={previewRef} details={displayDetails} questions={displayQuestions} />
        )}
        {isGeneratingPdf && answerKeyData && (
          <AnswerKeyPreview
            innerRef={answerKeyRef}
            booklets={answerKeyData}
            courseName={testDetails.course}
          />
        )}
        {isGeneratingPdf && currentlyRenderingOpticalForm && (
          <OpticalForm
              innerRef={opticalFormRef}
              booklet={currentlyRenderingOpticalForm}
              questionCount={questions.length}
          />
        )}
      </div>
    </>
  );
};

export default App;