import Color from "color";
import {
  Dispatch,
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  SetStateAction,
  useImperativeHandle,
  useState
} from "react";
import { Search } from "lucide-react";
import { requestSuggest } from "@mahiru/ui/info/hooks/useSearch";

interface SearchInputProps {
  setKeywords: Dispatch<SetStateAction<string>>;
  placeholder?: string;
  themeSync: ThemeSync;
}

export interface SearchInputRef {
  setInputWords: Dispatch<SetStateAction<string>>;
}

const SearchInput: ForwardRefRenderFunction<SearchInputRef, SearchInputProps> = (
  { placeholder, setKeywords, themeSync },
  ref
) => {
  const [inputWords, setInputWords] = useState("");
  const [suggestions, setSuggestions] =
    useState<Nullable<NeteaseSearchSuggestionResponse["result"]>>(null);
  const [focus, setFocus] = useState(false);
  useImperativeHandle(ref, () => ({
    setInputWords
  }));
  return (
    <div className="w-1/2 relative">
      <input
        style={{
          background: Color(themeSync.mainColor).alpha(0.8).string(),
          color: themeSync.textColorOnMain
        }}
        value={inputWords}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onChange={(e) => {
          setInputWords(e.target.value);
          if (e.target.value.trim() !== "") {
            requestSuggest(e.target.value, setSuggestions);
          } else {
            setSuggestions(null);
            setKeywords("");
          }
        }}
        className="w-full h-10 backdrop-blur-sm rounded-full shadow-2xs border border-gray-600/20 focus:outline-none px-4 pr-8"
        placeholder={placeholder}
      />
      <Search
        color={themeSync.textColorOnMain}
        className="absolute right-4 top-1/2 -translate-y-1/2 hover:opacity-50 active:scale-90 ease-in-out duration-300 transition-all"
        onClick={() => {
          setKeywords(inputWords);
        }}
      />
    </div>
  );
};
export default memo(forwardRef(SearchInput));
